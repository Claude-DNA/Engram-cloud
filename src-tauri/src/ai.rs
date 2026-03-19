use serde_json::{json, Value};

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
