use serde_json::{json, Value};

// ── Existing: test_api_key ────────────────────────────────────────────────────

#[tauri::command]
pub async fn test_api_key(provider: String, key: String, model: String) -> Result<Value, String> {
    match provider.as_str() {
        "gemini" => test_gemini(key, model).await,
        "openai" => test_openai(key, model).await,
        "anthropic" => test_anthropic(key, model).await,
        _ => Err(format!("Unknown provider: {}", provider)),
    }
}

async fn test_gemini(key: String, model: String) -> Result<Value, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, key
    );
    let body = json!({
        "contents": [{ "parts": [{ "text": "Hi" }] }],
        "generationConfig": { "maxOutputTokens": 8 }
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        Ok(json!({ "ok": true, "model": model, "message": format!("Connected to Gemini ({})", model) }))
    } else {
        let text = resp.text().await.unwrap_or_default();
        Ok(json!({ "ok": false, "model": model, "message": extract_error(&text) }))
    }
}

async fn test_openai(key: String, model: String) -> Result<Value, String> {
    let body = json!({
        "model": model,
        "messages": [{ "role": "user", "content": "Hi" }],
        "max_tokens": 8
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        Ok(json!({ "ok": true, "model": model, "message": format!("Connected to OpenAI ({})", model) }))
    } else {
        let text = resp.text().await.unwrap_or_default();
        Ok(json!({ "ok": false, "model": model, "message": extract_error(&text) }))
    }
}

async fn test_anthropic(key: String, model: String) -> Result<Value, String> {
    let body = json!({
        "model": model,
        "max_tokens": 8,
        "messages": [{ "role": "user", "content": "Hi" }]
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        Ok(json!({ "ok": true, "model": model, "message": format!("Connected to Anthropic ({})", model) }))
    } else {
        let text = resp.text().await.unwrap_or_default();
        Ok(json!({ "ok": false, "model": model, "message": extract_error(&text) }))
    }
}

// ── New: ai_send_prompt ───────────────────────────────────────────────────────

/// Send a prompt to any supported AI provider with automatic rate-limit retry.
/// Returns standardised JSON: { content, usage: {inputTokens, outputTokens,
/// totalTokens}, model, latencyMs, finishReason }
#[tauri::command]
pub async fn ai_send_prompt(
    provider: String,
    api_key: String,
    system_prompt: String,
    user_content: String,
    model: String,
    temperature: f64,
    max_tokens: u32,
) -> Result<Value, String> {
    let start = std::time::Instant::now();
    let mut last_err = String::from("No attempts made");

    for attempt in 0u32..3 {
        if attempt > 0 {
            // Exponential backoff: 1s, 2s
            let delay_ms = 1000u64 * (attempt as u64);
            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        }

        let result = match provider.as_str() {
            "gemini" => {
                send_gemini_prompt(&api_key, &system_prompt, &user_content, &model, temperature, max_tokens).await
            }
            "openai" => {
                send_openai_prompt(&api_key, &system_prompt, &user_content, &model, temperature, max_tokens).await
            }
            "anthropic" => {
                send_anthropic_prompt(&api_key, &system_prompt, &user_content, &model, temperature, max_tokens).await
            }
            _ => return Err(format!("Unknown provider: {}", provider)),
        };

        match result {
            Ok(mut v) => {
                v["latencyMs"] = json!(start.elapsed().as_millis() as u64);
                return Ok(v);
            }
            Err(ref e) if e.contains("429") || e.contains("rate_limit") || e.contains("rate limit") => {
                last_err = e.clone();
                continue;
            }
            Err(e) => return Err(e),
        }
    }

    Err(format!("Rate limited after 3 attempts: {}", last_err))
}

async fn send_gemini_prompt(
    key: &str,
    system_prompt: &str,
    user_content: &str,
    model: &str,
    temperature: f64,
    max_tokens: u32,
) -> Result<Value, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, key
    );

    let body = json!({
        "systemInstruction": { "parts": [{ "text": system_prompt }] },
        "contents": [{ "parts": [{ "text": user_content }] }],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens
        }
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if status == 429 {
        return Err(format!("429 rate limit: {}", extract_error(&text)));
    }
    if !status.is_success() {
        return Err(format!("Gemini error {}: {}", status, extract_error(&text)));
    }

    let v: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let content = v["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let finish_reason = v["candidates"][0]["finishReason"]
        .as_str()
        .unwrap_or("STOP")
        .to_lowercase();
    let input_tokens = v["usageMetadata"]["promptTokenCount"].as_u64().unwrap_or(0);
    let output_tokens = v["usageMetadata"]["candidatesTokenCount"].as_u64().unwrap_or(0);

    Ok(json!({
        "content": content,
        "usage": {
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "totalTokens": input_tokens + output_tokens
        },
        "model": model,
        "finishReason": finish_reason
    }))
}

async fn send_openai_prompt(
    key: &str,
    system_prompt: &str,
    user_content: &str,
    model: &str,
    temperature: f64,
    max_tokens: u32,
) -> Result<Value, String> {
    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_content }
        ],
        "temperature": temperature,
        "max_tokens": max_tokens
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if status == 429 {
        return Err(format!("429 rate limit: {}", extract_error(&text)));
    }
    if !status.is_success() {
        return Err(format!("OpenAI error {}: {}", status, extract_error(&text)));
    }

    let v: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let content = v["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let finish_reason = v["choices"][0]["finish_reason"]
        .as_str()
        .unwrap_or("stop")
        .to_string();
    let input_tokens = v["usage"]["prompt_tokens"].as_u64().unwrap_or(0);
    let output_tokens = v["usage"]["completion_tokens"].as_u64().unwrap_or(0);
    let response_model = v["model"].as_str().unwrap_or(model).to_string();

    Ok(json!({
        "content": content,
        "usage": {
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "totalTokens": input_tokens + output_tokens
        },
        "model": response_model,
        "finishReason": finish_reason
    }))
}

async fn send_anthropic_prompt(
    key: &str,
    system_prompt: &str,
    user_content: &str,
    model: &str,
    temperature: f64,
    max_tokens: u32,
) -> Result<Value, String> {
    let body = json!({
        "model": model,
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [{ "role": "user", "content": user_content }],
        "temperature": temperature
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if status == 429 {
        return Err(format!("429 rate limit: {}", extract_error(&text)));
    }
    if !status.is_success() {
        return Err(format!("Anthropic error {}: {}", status, extract_error(&text)));
    }

    let v: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let content = v["content"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let finish_reason = v["stop_reason"]
        .as_str()
        .unwrap_or("end_turn")
        .to_string();
    let input_tokens = v["usage"]["input_tokens"].as_u64().unwrap_or(0);
    let output_tokens = v["usage"]["output_tokens"].as_u64().unwrap_or(0);
    let response_model = v["model"].as_str().unwrap_or(model).to_string();

    Ok(json!({
        "content": content,
        "usage": {
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "totalTokens": input_tokens + output_tokens
        },
        "model": response_model,
        "finishReason": finish_reason
    }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn extract_error(text: &str) -> String {
    if let Ok(v) = serde_json::from_str::<Value>(text) {
        if let Some(msg) = v["error"]["message"].as_str() {
            return msg.to_string();
        }
        if let Some(msg) = v["error"]["code"].as_str() {
            return msg.to_string();
        }
    }
    let truncated = if text.len() > 200 { &text[..200] } else { text };
    if truncated.is_empty() { "Request failed".to_string() } else { truncated.to_string() }
}
