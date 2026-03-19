use argon2::{
    password_hash::{
        rand_core::{OsRng, RngCore},
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
    },
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
    /// Argon2 hash of the 24-word BIP-39 recovery mnemonic (space-joined)
    #[serde(default)]
    recovery_key_hash: Option<String>,
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

// ── Passphrase ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_passphrase(app: tauri::AppHandle, passphrase: String) -> Result<(), String> {
    if passphrase.len() < 8 {
        return Err("Passphrase must be at least 8 characters".to_string());
    }

    let path = get_auth_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(passphrase.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();

    // Preserve existing recovery key when changing passphrase
    let existing_recovery = read_auth_data(&path).and_then(|d| d.recovery_key_hash);

    let auth_data = AuthData {
        hash,
        created_at: now_secs(),
        failed_attempts: vec![],
        cooldown_until: None,
        recovery_key_hash: existing_recovery,
    };

    write_auth_data(&path, &auth_data)
}

#[tauri::command]
pub async fn verify_passphrase(app: tauri::AppHandle, passphrase: String) -> Result<bool, String> {
    let path = get_auth_path(&app)?;
    let mut auth_data =
        read_auth_data(&path).ok_or_else(|| "No passphrase configured".to_string())?;

    let now = now_secs();

    if let Some(cooldown_until) = auth_data.cooldown_until {
        if now < cooldown_until {
            return Err(format!(
                "Too many failed attempts. Try again in {} seconds.",
                cooldown_until - now
            ));
        }
        auth_data.cooldown_until = None;
        auth_data.failed_attempts.clear();
    }

    auth_data.failed_attempts.retain(|&t| now - t < 60);

    if auth_data.failed_attempts.len() >= 5 {
        auth_data.cooldown_until = Some(now + 30);
        write_auth_data(&path, &auth_data)?;
        return Err("Too many failed attempts. Try again in 30 seconds.".to_string());
    }

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

// ── Recovery key ─────────────────────────────────────────────────────────────

/// Generate a fresh 24-word BIP-39 mnemonic, store its Argon2 hash in auth.json,
/// and return the word list to display once to the user.
/// Must be called after `create_passphrase`.
#[tauri::command]
pub async fn generate_recovery_key(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    use bip39::Mnemonic;

    // Generate 32 bytes of entropy via OsRng (fill_bytes has no Rng-version constraint).
    // Pass the raw bytes to bip39::Mnemonic::from_entropy — no Rng generic needed.
    let mut entropy = [0u8; 32];
    OsRng.fill_bytes(&mut entropy);

    let mnemonic = Mnemonic::from_entropy(&entropy).map_err(|e| e.to_string())?;
    let phrase = mnemonic.to_string();
    let words: Vec<String> = phrase.split_whitespace().map(String::from).collect();

    let path = get_auth_path(&app)?;
    let mut auth_data =
        read_auth_data(&path).ok_or_else(|| "No passphrase configured".to_string())?;

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(phrase.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();

    auth_data.recovery_key_hash = Some(hash);
    write_auth_data(&path, &auth_data)?;

    Ok(words)
}

/// Verify that the supplied words match the stored recovery key hash.
#[tauri::command]
pub async fn verify_recovery_key(
    app: tauri::AppHandle,
    words: Vec<String>,
) -> Result<bool, String> {
    let path = get_auth_path(&app)?;
    let auth_data =
        read_auth_data(&path).ok_or_else(|| "No passphrase configured".to_string())?;

    let hash_str = auth_data
        .recovery_key_hash
        .ok_or_else(|| "No recovery key configured".to_string())?;

    let phrase = words.join(" ");
    let parsed_hash = PasswordHash::new(&hash_str).map_err(|e| e.to_string())?;
    Ok(Argon2::default()
        .verify_password(phrase.as_bytes(), &parsed_hash)
        .is_ok())
}

/// Reset passphrase using the recovery key. Preserves the existing recovery key hash.
#[tauri::command]
pub async fn reset_passphrase_with_recovery(
    app: tauri::AppHandle,
    recovery_words: Vec<String>,
    new_passphrase: String,
) -> Result<(), String> {
    if new_passphrase.len() < 8 {
        return Err("Passphrase must be at least 8 characters".to_string());
    }

    let path = get_auth_path(&app)?;
    let auth_data =
        read_auth_data(&path).ok_or_else(|| "No passphrase configured".to_string())?;

    let hash_str = auth_data
        .recovery_key_hash
        .ok_or_else(|| "No recovery key configured".to_string())?;

    let phrase = recovery_words.join(" ");
    let parsed_hash = PasswordHash::new(&hash_str).map_err(|e| e.to_string())?;
    if Argon2::default()
        .verify_password(phrase.as_bytes(), &parsed_hash)
        .is_err()
    {
        return Err("Invalid recovery key".to_string());
    }

    let salt = SaltString::generate(&mut OsRng);
    let new_hash = Argon2::default()
        .hash_password(new_passphrase.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();

    write_auth_data(
        &path,
        &AuthData {
            hash: new_hash,
            created_at: now_secs(),
            failed_attempts: vec![],
            cooldown_until: None,
            recovery_key_hash: Some(hash_str),
        },
    )
}

// ── Biometric ─────────────────────────────────────────────────────────────────

/// Returns true if biometric auth is available on this device.
/// Currently returns false on desktop (Touch ID support requires entitlement signing).
#[tauri::command]
pub async fn check_biometric_availability() -> Result<bool, String> {
    Ok(false)
}

/// Trigger a biometric prompt. Currently unsupported on desktop.
#[tauri::command]
pub async fn biometric_authenticate() -> Result<(), String> {
    Err("Biometric authentication is not available on this platform".to_string())
}
