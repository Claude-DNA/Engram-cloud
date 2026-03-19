use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Serialize, Deserialize, Clone)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub file_type: String,    // "text", "image", "document", "archive", "other"
    pub extension: String,
    pub size_bytes: u64,
    pub modified_at: Option<String>,
}

fn classify_extension(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "txt" | "md" | "markdown" | "rtf" | "csv" | "log" | "json" | "xml" | "yaml" | "yml"
        | "toml" | "ini" | "cfg" => "text",
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "heic" | "heif" | "bmp" | "tiff" | "tif"
        | "svg" | "ico" => "image",
        "pdf" | "doc" | "docx" | "odt" | "xls" | "xlsx" | "ppt" | "pptx" | "pages"
        | "numbers" | "key" => "document",
        "zip" | "tar" | "gz" | "7z" | "rar" | "bz2" => "archive",
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "m4a" | "wma" => "audio",
        "mp4" | "mov" | "avi" | "mkv" | "webm" | "m4v" | "wmv" => "video",
        _ => "other",
    }
}

fn system_time_to_iso(st: SystemTime) -> Option<String> {
    st.duration_since(SystemTime::UNIX_EPOCH)
        .ok()
        .map(|d| {
            let secs = d.as_secs() as i64;
            // Simple ISO-8601 without chrono dependency
            let days = secs / 86400;
            let time_secs = secs % 86400;
            let hours = time_secs / 3600;
            let mins = (time_secs % 3600) / 60;
            let s = time_secs % 60;

            // Approximate date calculation (good enough for display)
            let mut y: i64 = 1970;
            let mut remaining_days = days;
            loop {
                let days_in_year = if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) {
                    366
                } else {
                    365
                };
                if remaining_days < days_in_year {
                    break;
                }
                remaining_days -= days_in_year;
                y += 1;
            }
            let is_leap = y % 4 == 0 && (y % 100 != 0 || y % 400 == 0);
            let month_days = [
                31,
                if is_leap { 29 } else { 28 },
                31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
            ];
            let mut m = 0;
            for (i, &md) in month_days.iter().enumerate() {
                if remaining_days < md {
                    m = i;
                    break;
                }
                remaining_days -= md;
            }
            format!(
                "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
                y,
                m + 1,
                remaining_days + 1,
                hours,
                mins,
                s
            )
        })
}

/// Blocked system directories that should never be scanned
fn is_system_dir(path: &Path) -> bool {
    let s = path.to_string_lossy();
    let blocked = [
        "/System",
        "/Library",
        "/usr",
        "/bin",
        "/sbin",
        "/private",
        "/var",
        "/etc",
        "/dev",
        "/proc",
        "C:\\Windows",
        "C:\\Program Files",
        "C:\\Program Files (x86)",
    ];
    blocked.iter().any(|b| s.starts_with(b))
}

fn scan_recursive(
    dir: &Path,
    max_depth: u32,
    current_depth: u32,
    include_hidden: bool,
    max_files: usize,
    files: &mut Vec<FileInfo>,
) -> Result<(), String> {
    if current_depth > max_depth {
        return Ok(());
    }
    if files.len() >= max_files {
        return Ok(());
    }

    let entries = std::fs::read_dir(dir).map_err(|e| format!("Cannot read {}: {e}", dir.display()))?;

    for entry in entries {
        if files.len() >= max_files {
            break;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs unless requested
        if !include_hidden && name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            scan_recursive(&path, max_depth, current_depth + 1, include_hidden, max_files, files)?;
        } else if path.is_file() {
            let ext = path
                .extension()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default();
            let file_type = classify_extension(&ext).to_string();

            let metadata = std::fs::metadata(&path).ok();
            let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified_at = metadata
                .and_then(|m| m.modified().ok())
                .and_then(system_time_to_iso);

            // Skip files <10 bytes or >50MB
            if size_bytes < 10 || size_bytes > 50 * 1024 * 1024 {
                continue;
            }

            // Skip "other" types we can't process
            if file_type == "other" || file_type == "audio" || file_type == "video" {
                continue;
            }

            files.push(FileInfo {
                path: path.to_string_lossy().to_string(),
                name,
                file_type,
                extension: ext,
                size_bytes,
                modified_at,
            });
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn folder_scan(
    path: String,
    max_depth: Option<u32>,
    include_hidden: Option<bool>,
    max_files: Option<usize>,
) -> Result<Value, String> {
    let dir = PathBuf::from(&path);

    if !dir.exists() {
        return Err("Folder does not exist".to_string());
    }
    if !dir.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    if is_system_dir(&dir) {
        return Err("Cannot scan system directories for safety reasons".to_string());
    }

    let max_depth = max_depth.unwrap_or(5);
    let include_hidden = include_hidden.unwrap_or(false);
    let max_files = max_files.unwrap_or(10_000);

    let mut files: Vec<FileInfo> = Vec::new();
    scan_recursive(&dir, max_depth, 0, include_hidden, max_files, &mut files)?;

    // Group by type
    let text_files: Vec<&FileInfo> = files.iter().filter(|f| f.file_type == "text").collect();
    let image_files: Vec<&FileInfo> = files.iter().filter(|f| f.file_type == "image").collect();
    let doc_files: Vec<&FileInfo> = files.iter().filter(|f| f.file_type == "document").collect();
    let archive_files: Vec<&FileInfo> = files.iter().filter(|f| f.file_type == "archive").collect();

    let total_size: u64 = files.iter().map(|f| f.size_bytes).sum();

    // Date range
    let dates: Vec<&str> = files
        .iter()
        .filter_map(|f| f.modified_at.as_deref())
        .collect();
    let oldest = dates.iter().min().map(|s| s.to_string());
    let newest = dates.iter().max().map(|s| s.to_string());

    Ok(json!({
        "folderPath": path,
        "totalFiles": files.len(),
        "totalSizeBytes": total_size,
        "hitLimit": files.len() >= max_files,
        "byType": {
            "text": text_files.len(),
            "images": image_files.len(),
            "documents": doc_files.len(),
            "archives": archive_files.len(),
        },
        "dateRange": {
            "oldest": oldest,
            "newest": newest,
        },
        "files": files,
    }))
}
