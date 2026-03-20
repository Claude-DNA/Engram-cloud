// oauth.rs — Native OAuth via ASWebAuthenticationSession
// Uses macOS/iOS native auth sheet for all OAuth providers
// Tokens stored in Keychain via security-framework

use security_framework::passwords::{delete_generic_password, get_generic_password, set_generic_password};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Clone)]
pub struct OAuthTokens {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: Option<String>,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<String>,
    pub scope: Option<String>,
}

const KEYCHAIN_SERVICE: &str = "engram-cloud-oauth";

/// Start OAuth flow using ASWebAuthenticationSession
/// On macOS: opens native auth sheet in system browser
/// On iOS: opens SFAuthenticationSession
#[tauri::command]
pub async fn oauth_native_auth(
    _app: tauri::AppHandle,
    provider: String,
    auth_url: String,
    token_url: String,
    scope: String,
    use_pkce: bool,
    callback_scheme: String,
    client_id: String,
) -> Result<OAuthTokens, String> {
    // Generate PKCE if needed
    let (code_verifier, code_challenge) = if use_pkce {
        let verifier = generate_pkce_verifier();
        let challenge = generate_pkce_challenge(&verifier);
        (Some(verifier), Some(challenge))
    } else {
        (None, None)
    };

    // Google desktop apps require http://localhost redirect
    let redirect_uri = if provider == "google_drive" || provider == "youtube" {
        "http://localhost".to_string()
    } else {
        format!("{}://oauth/{}", callback_scheme, provider)
    };

    // Build auth URL with params
    // Start callback listener FIRST to get the port
    use std::net::TcpListener;
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind callback server: {}", e))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    
    // Use the actual port in redirect_uri so Google redirects to our server
    let actual_redirect = format!("http://localhost:{}", port);

    let mut url = format!(
        "{}?response_type=code&redirect_uri={}&scope={}",
        auth_url,
        urlencoding::encode(&actual_redirect),
        urlencoding::encode(&scope),
    );

    if let Some(ref challenge) = code_challenge {
        url.push_str(&format!(
            "&code_challenge={}&code_challenge_method=S256",
            challenge
        ));
    }

    url.push_str(&format!("&client_id={}", urlencoding::encode(&client_id)));

    // Open ASWebAuthenticationSession
    // This is the native macOS/iOS auth flow
    let callback_url = open_auth_session_with_listener(&url, listener)
        .await
        .map_err(|e| format!("Auth session failed: {}", e))?;

    // Extract authorization code from callback URL
    let code = extract_code_from_url(&callback_url)
        .ok_or_else(|| "No authorization code in callback".to_string())?;

    // Load client secret from google-oauth.json (not committed to repo)
    let client_secret: Option<String> = if provider == "google_drive" || provider == "youtube" {
        let oauth_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("google-oauth.json");
        if let Ok(json_str) = std::fs::read_to_string(&oauth_path) {
            let v: serde_json::Value = serde_json::from_str(&json_str).unwrap_or_default();
            v["installed"]["client_secret"].as_str().map(String::from)
        } else {
            None
        }
    } else {
        None
    };

    // Exchange code for tokens (redirect_uri must match what was in auth URL)
    let tokens = exchange_code_for_tokens(
        &token_url,
        &code,
        &actual_redirect,
        code_verifier.as_deref(),
        &client_id,
        client_secret.as_deref(),
    )
    .await
    .map_err(|e| format!("Token exchange failed: {}", e))?;

    // Store tokens (try Keychain, fall back to file)
    store_tokens(&provider, &tokens)?;

    Ok(tokens)
}

/// Refresh an access token using the stored refresh token
#[tauri::command]
pub async fn oauth_refresh_token(
    provider: String,
    token_url: String,
) -> Result<OAuthTokens, String> {
    let stored = get_stored_tokens(&provider)?;
    let refresh_token = stored
        .refresh_token
        .ok_or("No refresh token available")?;

    let client = reqwest::Client::new();
    let resp = client
        .post(&token_url)
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", &refresh_token),
            // TODO: Add client_id and client_secret from secure config
        ])
        .send()
        .await
        .map_err(|e| format!("Refresh request failed: {}", e))?;

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;

    let tokens = OAuthTokens {
        access_token: body["access_token"]
            .as_str()
            .ok_or("No access_token in response")?
            .to_string(),
        refresh_token: body["refresh_token"]
            .as_str()
            .map(String::from)
            .or(Some(refresh_token)),
        expires_at: body["expires_in"].as_i64().map(|secs| {
            let expires = chrono::Utc::now() + chrono::Duration::seconds(secs);
            expires.to_rfc3339()
        }),
        scope: body["scope"].as_str().map(String::from),
    };

    // Update token storage
    store_tokens(&provider, &tokens)?;

    Ok(tokens)
}

/// Get stored tokens from Keychain
#[tauri::command]
pub async fn oauth_get_tokens(provider: String) -> Result<Option<OAuthTokens>, String> {
    match get_stored_tokens(&provider) {
        Ok(tokens) => Ok(Some(tokens)),
        Err(_) => Ok(None),
    }
}

/// Revoke tokens and remove from Keychain
#[tauri::command]
pub async fn oauth_revoke(provider: String) -> Result<(), String> {
    let _ = delete_generic_password(KEYCHAIN_SERVICE, &provider);
    // Also delete file fallback
    if let Ok(dir) = get_tokens_dir() {
        let _ = std::fs::remove_file(dir.join(format!("{}.json", &provider)));
    }
    Ok(())
}

// ── Internal helpers ──────────────────────────────────────────────────────────

fn get_tokens_dir() -> Result<std::path::PathBuf, String> {
    let dir = dirs::data_dir()
        .ok_or("No data directory")?
        .join("cloud.engram.app")
        .join("oauth");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn store_tokens(provider: &str, tokens: &OAuthTokens) -> Result<(), String> {
    let tokens_json = serde_json::to_string(tokens).map_err(|e| e.to_string())?;

    // Try Keychain first
    let _ = delete_generic_password(KEYCHAIN_SERVICE, provider);
    match set_generic_password(KEYCHAIN_SERVICE, provider, tokens_json.as_bytes()) {
        Ok(_) => return Ok(()),
        Err(_) => {
            // Fall back to file
            let path = get_tokens_dir()?.join(format!("{}.json", provider));
            std::fs::write(&path, &tokens_json)
                .map_err(|e| format!("Failed to store tokens: {}", e))?;
            println!("OAuth tokens stored in file (keychain unavailable in dev mode)");
            Ok(())
        }
    }
}

fn get_stored_tokens(provider: &str) -> Result<OAuthTokens, String> {
    // Try Keychain first
    if let Ok(raw) = get_generic_password(KEYCHAIN_SERVICE, provider) {
        if let Ok(json_str) = String::from_utf8(raw) {
            if let Ok(tokens) = serde_json::from_str(&json_str) {
                return Ok(tokens);
            }
        }
    }
    // Fall back to file
    let path = get_tokens_dir()?.join(format!("{}.json", provider));
    let json_str = std::fs::read_to_string(&path)
        .map_err(|_| format!("No tokens stored for {}", provider))?;
    serde_json::from_str(&json_str).map_err(|e| e.to_string())
}

fn generate_pkce_verifier() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    base64_url_encode(&bytes)
}

fn generate_pkce_challenge(verifier: &str) -> String {
    use sha2::{Digest, Sha256};
    let hash = Sha256::digest(verifier.as_bytes());
    base64_url_encode(&hash)
}

fn base64_url_encode(bytes: &[u8]) -> String {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    URL_SAFE_NO_PAD.encode(bytes)
}

fn extract_code_from_url(url: &str) -> Option<String> {
    url::Url::parse(url)
        .ok()?
        .query_pairs()
        .find(|(key, _)| key == "code")
        .map(|(_, val)| val.to_string())
}

async fn exchange_code_for_tokens(
    token_url: &str,
    code: &str,
    redirect_uri: &str,
    code_verifier: Option<&str>,
    client_id: &str,
    client_secret: Option<&str>,
) -> Result<OAuthTokens, String> {
    let client = reqwest::Client::new();
    let mut params: Vec<(&str, &str)> = vec![
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("client_id", client_id),
    ];

    if let Some(secret) = client_secret {
        params.push(("client_secret", secret));
    }
    if let Some(verifier) = code_verifier {
        params.push(("code_verifier", verifier));
    }

    let resp = client
        .post(token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token exchange request failed: {}", e))?;

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;

    if let Some(error) = body["error"].as_str() {
        return Err(format!("OAuth error: {}", error));
    }

    Ok(OAuthTokens {
        access_token: body["access_token"]
            .as_str()
            .ok_or("No access_token in response")?
            .to_string(),
        refresh_token: body["refresh_token"].as_str().map(String::from),
        expires_at: body["expires_in"].as_i64().map(|secs| {
            let expires = chrono::Utc::now() + chrono::Duration::seconds(secs);
            expires.to_rfc3339()
        }),
        scope: body["scope"].as_str().map(String::from),
    })
}

/// Opens browser and waits for OAuth callback on the pre-bound listener
async fn open_auth_session_with_listener(url: &str, listener: std::net::TcpListener) -> Result<String, String> {
    use std::io::{BufRead, BufReader, Write};

    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    // Open the browser with the auth URL (redirect_uri already has our port)
    open::that(url).map_err(|e| format!("Failed to open browser: {}", e))?;

    // Wait for the callback
    let (mut stream, _) = listener.accept()
        .map_err(|e| format!("Failed to accept callback: {}", e))?;

    let mut reader = BufReader::new(&stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)
        .map_err(|e| format!("Failed to read callback: {}", e))?;

    // Extract path from "GET /?code=...&scope=... HTTP/1.1"
    let path = request_line
        .split_whitespace()
        .nth(1)
        .ok_or("Invalid HTTP request")?
        .to_string();

    let callback_url = format!("http://localhost:{}{}", port, path);

    // Send success page to browser
    let body = "<html><body style='font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1e1b2e;color:#e2e8f0'><div style='text-align:center'><h1>Connected!</h1><p>You can close this tab and return to Engram Cloud.</p></div></body></html>";
    let response = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{}", body.len(), body);
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();

    Ok(callback_url)
}
