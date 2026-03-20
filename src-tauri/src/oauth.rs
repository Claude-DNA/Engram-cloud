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
) -> Result<OAuthTokens, String> {
    // Generate PKCE if needed
    let (code_verifier, code_challenge) = if use_pkce {
        let verifier = generate_pkce_verifier();
        let challenge = generate_pkce_challenge(&verifier);
        (Some(verifier), Some(challenge))
    } else {
        (None, None)
    };

    let redirect_uri = format!("{}://oauth/{}", callback_scheme, provider);

    // Build auth URL with params
    let mut url = format!(
        "{}?response_type=code&redirect_uri={}&scope={}",
        auth_url,
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&scope),
    );

    if let Some(ref challenge) = code_challenge {
        url.push_str(&format!(
            "&code_challenge={}&code_challenge_method=S256",
            challenge
        ));
    }

    // TODO: Add client_id from secure config
    // url.push_str(&format!("&client_id={}", client_id));

    // Open ASWebAuthenticationSession
    // This is the native macOS/iOS auth flow
    let callback_url = open_auth_session(&url, &callback_scheme)
        .await
        .map_err(|e| format!("Auth session failed: {}", e))?;

    // Extract authorization code from callback URL
    let code = extract_code_from_url(&callback_url)
        .ok_or_else(|| "No authorization code in callback".to_string())?;

    // Exchange code for tokens
    let tokens = exchange_code_for_tokens(
        &token_url,
        &code,
        &redirect_uri,
        code_verifier.as_deref(),
    )
    .await
    .map_err(|e| format!("Token exchange failed: {}", e))?;

    // Store in Keychain
    let tokens_json = serde_json::to_string(&tokens).map_err(|e| e.to_string())?;
    let _ = delete_generic_password(KEYCHAIN_SERVICE, &provider);
    set_generic_password(KEYCHAIN_SERVICE, &provider, tokens_json.as_bytes())
        .map_err(|e| format!("Failed to store tokens in keychain: {}", e))?;

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

    // Update Keychain
    let tokens_json = serde_json::to_string(&tokens).map_err(|e| e.to_string())?;
    let _ = delete_generic_password(KEYCHAIN_SERVICE, &provider);
    set_generic_password(KEYCHAIN_SERVICE, &provider, tokens_json.as_bytes())
        .map_err(|e| format!("Failed to update tokens in keychain: {}", e))?;

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
    Ok(())
}

// ── Internal helpers ──────────────────────────────────────────────────────────

fn get_stored_tokens(provider: &str) -> Result<OAuthTokens, String> {
    let raw = get_generic_password(KEYCHAIN_SERVICE, provider)
        .map_err(|_| format!("No tokens stored for {}", provider))?;
    let json_str = String::from_utf8(raw).map_err(|e| e.to_string())?;
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
) -> Result<OAuthTokens, String> {
    let client = reqwest::Client::new();
    let mut params: Vec<(&str, &str)> = vec![
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", redirect_uri),
        // TODO: Add client_id and client_secret from secure config
    ];

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

/// Opens ASWebAuthenticationSession on macOS
/// TODO: Implement via objc2 crate or swift-bridge
/// For now, falls back to opening URL in default browser
async fn open_auth_session(url: &str, _callback_scheme: &str) -> Result<String, String> {
    // Phase 1: Open in default browser (works, but requires manual URL copy)
    // Phase 2: Use ASWebAuthenticationSession via objc2 for true native flow
    
    open::that(url).map_err(|e| format!("Failed to open browser: {}", e))?;
    
    // For now, return an error indicating the native session needs implementation
    // The frontend will show a "paste callback URL" fallback
    Err("ASWebAuthenticationSession not yet wired — paste callback URL manually".to_string())
}
