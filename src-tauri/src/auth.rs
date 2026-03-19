use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct AuthData {
    hash: String,
    created_at: u64,
    /// Unix timestamps (seconds) of recent failed attempts
    failed_attempts: Vec<u64>,
    /// Unix timestamp when cooldown expires
    cooldown_until: Option<u64>,
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn get_auth_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data_dir.join("auth.json"))
}

fn read_auth_data(path: &std::path::Path) -> Option<AuthData> {
    let content = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn write_auth_data(path: &std::path::Path, data: &AuthData) -> Result<(), String> {
    let content = serde_json::to_string(data).map_err(|e| e.to_string())?;
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_passphrase(app: tauri::AppHandle, passphrase: String) -> Result<(), String> {
    if passphrase.len() < 8 {
        return Err("Passphrase must be at least 8 characters".to_string());
    }

    let path = get_auth_path(&app)?;
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(passphrase.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();

    let auth_data = AuthData {
        hash,
        created_at: now_secs(),
        failed_attempts: vec![],
        cooldown_until: None,
    };

    write_auth_data(&path, &auth_data)
}

#[tauri::command]
pub async fn verify_passphrase(app: tauri::AppHandle, passphrase: String) -> Result<bool, String> {
    let path = get_auth_path(&app)?;
    let mut auth_data =
        read_auth_data(&path).ok_or_else(|| "No passphrase configured".to_string())?;

    let now = now_secs();

    // Check active cooldown
    if let Some(cooldown_until) = auth_data.cooldown_until {
        if now < cooldown_until {
            return Err(format!(
                "Too many failed attempts. Try again in {} seconds.",
                cooldown_until - now
            ));
        }
        // Cooldown expired — reset
        auth_data.cooldown_until = None;
        auth_data.failed_attempts.clear();
    }

    // Purge attempts older than 60 seconds
    auth_data.failed_attempts.retain(|&t| now - t < 60);

    // Enforce rate limit before even trying
    if auth_data.failed_attempts.len() >= 5 {
        auth_data.cooldown_until = Some(now + 30);
        write_auth_data(&path, &auth_data)?;
        return Err("Too many failed attempts. Try again in 30 seconds.".to_string());
    }

    // Constant-time verification via argon2
    let parsed_hash = PasswordHash::new(&auth_data.hash).map_err(|e| e.to_string())?;
    let ok = Argon2::default()
        .verify_password(passphrase.as_bytes(), &parsed_hash)
        .is_ok();

    if ok {
        auth_data.failed_attempts.clear();
        auth_data.cooldown_until = None;
    } else {
        auth_data.failed_attempts.push(now);
        if auth_data.failed_attempts.len() >= 5 {
            auth_data.cooldown_until = Some(now + 30);
        }
    }

    write_auth_data(&path, &auth_data)?;
    Ok(ok)
}

#[tauri::command]
pub async fn has_passphrase(app: tauri::AppHandle) -> Result<bool, String> {
    let path = get_auth_path(&app)?;
    Ok(path.exists() && read_auth_data(&path).is_some())
}

#[tauri::command]
pub async fn get_cooldown_remaining(app: tauri::AppHandle) -> Result<u64, String> {
    let path = get_auth_path(&app)?;
    if let Some(auth_data) = read_auth_data(&path) {
        if let Some(cooldown_until) = auth_data.cooldown_until {
            let now = now_secs();
            if now < cooldown_until {
                return Ok(cooldown_until - now);
            }
        }
    }
    Ok(0)
}
