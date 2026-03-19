mod auth;
mod db;
mod keychain;

use db::EncryptedDb;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tauri::Manager;

struct DbState(Arc<Mutex<EncryptedDb>>);

fn get_db_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data_dir.join("engram.db"))
}

// ── Core DB commands (interface unchanged for frontend) ───────────────────────

#[tauri::command]
fn db_execute(
    state: tauri::State<'_, DbState>,
    sql: String,
    params: Vec<Value>,
) -> Result<Value, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    Ok(db.execute_sql(&sql, &params))
}

#[tauri::command]
fn db_query(
    state: tauri::State<'_, DbState>,
    sql: String,
    params: Vec<Value>,
) -> Result<Value, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    Ok(db.query_sql(&sql, &params))
}

#[tauri::command]
fn db_get_path(app: tauri::AppHandle) -> Result<Value, String> {
    let db_path = get_db_path(&app)?;
    Ok(json!({
        "ok": true,
        "data": db_path.to_string_lossy(),
        "error": null
    }))
}

// ── Encryption lifecycle commands ─────────────────────────────────────────────

/// Called after successful passphrase verification. Derives the DB key with
/// Argon2id, migrates from plaintext if needed, then opens the encrypted DB.
#[tauri::command]
fn unlock_database(
    state: tauri::State<'_, DbState>,
    app: tauri::AppHandle,
    passphrase: String,
) -> Result<Value, String> {
    let db_path = get_db_path(&app)?;
    let mut db = state.0.lock().map_err(|e| e.to_string())?;
    db.open(&db_path, &passphrase)
        .map_err(|e| e)?;
    Ok(json!({ "ok": true, "data": null, "error": null }))
}

/// Called when the app locks. Zeros the key and closes the connection.
#[tauri::command]
fn lock_database(state: tauri::State<'_, DbState>) -> Result<Value, String> {
    let mut db = state.0.lock().map_err(|e| e.to_string())?;
    db.close();
    Ok(json!({ "ok": true, "data": null, "error": null }))
}

/// Called after biometric authentication succeeds. Retrieves the key that was
/// cached in the keychain when the user last unlocked with their passphrase.
#[tauri::command]
fn unlock_database_biometric(
    state: tauri::State<'_, DbState>,
    app: tauri::AppHandle,
) -> Result<Value, String> {
    let db_path = get_db_path(&app)?;
    let mut db = state.0.lock().map_err(|e| e.to_string())?;
    db.open_biometric(&db_path)?;
    Ok(json!({ "ok": true, "data": null, "error": null }))
}

/// Called after passphrase reset via recovery key. Deletes the old (now
/// unreadable) encrypted DB and creates a fresh one with the new passphrase.
#[tauri::command]
fn reset_and_unlock_database(
    state: tauri::State<'_, DbState>,
    app: tauri::AppHandle,
    passphrase: String,
) -> Result<Value, String> {
    let db_path = get_db_path(&app)?;
    let mut db = state.0.lock().map_err(|e| e.to_string())?;
    db.reset_and_open(&db_path, &passphrase)?;
    Ok(json!({ "ok": true, "data": null, "error": null }))
}

// ── App entry point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("No app data directory");
            std::fs::create_dir_all(&app_data_dir)?;

            // DB starts locked; opened lazily via unlock_database after auth
            app.manage(DbState(Arc::new(Mutex::new(EncryptedDb::new()))));

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_execute,
            db_query,
            db_get_path,
            unlock_database,
            lock_database,
            unlock_database_biometric,
            reset_and_unlock_database,
            auth::create_passphrase,
            auth::verify_passphrase,
            auth::has_passphrase,
            auth::get_cooldown_remaining,
            auth::generate_recovery_key,
            auth::verify_recovery_key,
            auth::reset_passphrase_with_recovery,
            auth::check_biometric_availability,
            auth::biometric_authenticate,
            keychain::store_api_key,
            keychain::get_api_key,
            keychain::delete_api_key,
            keychain::has_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
