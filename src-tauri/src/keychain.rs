use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

const SERVICE: &str = "engram-cloud";

fn account_name(provider: &str) -> Result<String, String> {
    match provider {
        "gemini" | "openai" | "anthropic" => Ok(format!("api-key-{provider}")),
        _ => Err(format!("Unknown provider: {provider}")),
    }
}

#[tauri::command]
pub fn store_api_key(provider: String, key: String) -> Result<(), String> {
    let account = account_name(&provider)?;
    set_generic_password(SERVICE, &account, key.as_bytes())
        .map_err(|e| format!("Failed to store API key: {e}"))
}

#[tauri::command]
pub fn get_api_key(provider: String) -> Result<Option<String>, String> {
    let account = account_name(&provider)?;
    match get_generic_password(SERVICE, &account) {
        Ok(bytes) => {
            let key = String::from_utf8(bytes)
                .map_err(|e| format!("Invalid UTF-8 in stored key: {e}"))?;
            Ok(Some(key))
        }
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub fn delete_api_key(provider: String) -> Result<(), String> {
    let account = account_name(&provider)?;
    match delete_generic_password(SERVICE, &account) {
        Ok(()) => Ok(()),
        // If no entry exists, deletion is a no-op
        Err(_) => Ok(()),
    }
}

#[tauri::command]
pub fn has_api_key(provider: String) -> Result<bool, String> {
    let account = account_name(&provider)?;
    Ok(get_generic_password(SERVICE, &account).is_ok())
}
