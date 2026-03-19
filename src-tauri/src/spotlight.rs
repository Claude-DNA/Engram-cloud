/// CoreSpotlight integration — macOS only.
///
/// Implementation strategy:
///   Full CoreSpotlight integration requires the `objc2-core-spotlight` crate
///   (or raw Objective-C FFI). Since that crate is not yet stable on crates.io
///   we use a pragmatic two-tier approach:
///
///   1. An in-app metadata store: each indexed item is written as a JSON
///      metadata file into <app-data>/spotlight_index/<uuid>.json.
///      This lets us do reconciliation (diff DB vs index) reliably.
///
///   2. `mdfind` for local full-text search within the app data directory.
///      Spotlight automatically picks up JSON files on macOS 12+.
///
///   On non-macOS platforms all commands are no-ops that return ok:true.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use tauri::Manager;

// ── Shared types ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct SpotlightMeta {
    pub item_id: String,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub cloud_type: String,
    pub dates: Vec<String>,
}

// ── macOS helpers ──────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn spotlight_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let dir = base.join("spotlight_index");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[cfg(target_os = "macos")]
fn meta_path(dir: &PathBuf, item_id: &str) -> PathBuf {
    // Sanitise: replace path separators so filenames are safe
    let safe_id = item_id.replace(['/', '\\'], "_");
    dir.join(format!("{}.json", safe_id))
}

// ── Tauri commands ─────────────────────────────────────────────────────────────

/// Index a single item into Spotlight.
/// On macOS: writes a metadata JSON file that Spotlight can discover.
/// On other platforms: no-op.
#[tauri::command]
pub fn spotlight_index(
    app: tauri::AppHandle,
    item_id: String,
    title: String,
    content: String,
    tags: Vec<String>,
    cloud_type: String,
    dates: Vec<String>,
) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let dir = spotlight_dir(&app)?;
        let meta = SpotlightMeta {
            item_id: item_id.clone(),
            title,
            content,
            tags,
            cloud_type,
            dates,
        };
        let json_str = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
        std::fs::write(meta_path(&dir, &item_id), json_str).map_err(|e| e.to_string())?;
        return Ok(json!({ "ok": true, "data": null, "error": null }));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, item_id, title, content, tags, cloud_type, dates);
        Ok(json!({ "ok": true, "data": null, "error": null }))
    }
}

/// Remove a single item from the Spotlight index.
#[tauri::command]
pub fn spotlight_remove(
    app: tauri::AppHandle,
    item_id: String,
) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let dir = spotlight_dir(&app)?;
        let path = meta_path(&dir, &item_id);
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
        return Ok(json!({ "ok": true, "data": null, "error": null }));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, item_id);
        Ok(json!({ "ok": true, "data": null, "error": null }))
    }
}

/// Full reindex: delete the entire spotlight_index directory and recreate it.
/// The frontend is expected to re-push all items after calling this.
#[tauri::command]
pub fn spotlight_reindex_all(app: tauri::AppHandle) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let base = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?;
        let dir = base.join("spotlight_index");
        if dir.exists() {
            std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
        }
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        return Ok(json!({ "ok": true, "data": null, "error": null }));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(json!({ "ok": true, "data": null, "error": null }))
    }
}

/// Return all item_ids that are currently in the Spotlight index.
/// Used by the reconciliation pass on unlock.
#[tauri::command]
pub fn spotlight_get_indexed_ids(app: tauri::AppHandle) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let dir = spotlight_dir(&app)?;
        let mut ids: Vec<String> = Vec::new();
        for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.ends_with(".json") {
                // Try to read item_id from the file
                if let Ok(contents) = std::fs::read_to_string(entry.path()) {
                    if let Ok(meta) = serde_json::from_str::<SpotlightMeta>(&contents) {
                        ids.push(meta.item_id);
                    }
                }
            }
        }
        return Ok(json!({ "ok": true, "data": ids, "error": null }));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(json!({ "ok": true, "data": Vec::<String>::new(), "error": null }))
    }
}

/// Basic full-text search using `mdfind` (macOS only).
/// Returns matching file paths within the spotlight_index directory.
#[tauri::command]
pub fn spotlight_search(
    app: tauri::AppHandle,
    query: String,
) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let dir = spotlight_dir(&app)?;
        let dir_str = dir.to_string_lossy().to_string();
        let output = std::process::Command::new("mdfind")
            .args(["-onlyin", &dir_str, &query])
            .output()
            .map_err(|e| format!("mdfind failed: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let paths: Vec<String> = stdout
            .lines()
            .filter(|l| !l.is_empty())
            .map(String::from)
            .collect();
        return Ok(json!({ "ok": true, "data": paths, "error": null }));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, query);
        Ok(json!({ "ok": true, "data": Vec::<String>::new(), "error": null }))
    }
}
