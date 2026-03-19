use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

#[derive(Serialize, Deserialize)]
pub struct FetchResult {
    pub ok: bool,
    pub html: Option<String>,
    pub content_type: Option<String>,
    pub final_url: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn url_fetch(url: String) -> Result<Value, String> {
    // Validate URL
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("Invalid URL: {e}"))?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err("Only http and https URLs are supported".to_string());
    }

    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ),
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::limited(5))
        .default_headers(headers)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    match client.get(&url).send().await {
        Ok(response) => {
            let final_url = response.url().to_string();
            let content_type = response
                .headers()
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());

            // Check content length — reject >5MB
            if let Some(len) = response.content_length() {
                if len > 5 * 1024 * 1024 {
                    return Ok(json!({
                        "ok": false,
                        "html": null,
                        "content_type": content_type,
                        "final_url": final_url,
                        "error": "Response too large (>5MB)"
                    }));
                }
            }

            let status = response.status();
            if !status.is_success() {
                return Ok(json!({
                    "ok": false,
                    "html": null,
                    "content_type": content_type,
                    "final_url": final_url,
                    "error": format!("HTTP {}", status.as_u16())
                }));
            }

            match response.text().await {
                Ok(body) => {
                    // Truncate if somehow larger than 5MB
                    let body = if body.len() > 5 * 1024 * 1024 {
                        body[..5 * 1024 * 1024].to_string()
                    } else {
                        body
                    };
                    Ok(json!({
                        "ok": true,
                        "html": body,
                        "content_type": content_type,
                        "final_url": final_url,
                        "error": null
                    }))
                }
                Err(e) => Ok(json!({
                    "ok": false,
                    "html": null,
                    "content_type": content_type,
                    "final_url": final_url,
                    "error": format!("Failed to read response body: {e}")
                })),
            }
        }
        Err(e) => {
            let msg = if e.is_timeout() {
                "Request timed out (15s)".to_string()
            } else if e.is_connect() {
                "Couldn't connect. Check the URL and try again.".to_string()
            } else {
                format!("Request failed: {e}")
            };
            Ok(json!({
                "ok": false,
                "html": null,
                "content_type": null,
                "final_url": null,
                "error": msg
            }))
        }
    }
}
