/// Deep link handler for engram-cloud:// URL scheme.
///
/// Supported URLs:
///   engram-cloud://new                          -> open New Item modal
///   engram-cloud://new?cloud=memory             -> New Item for specific cloud
///   engram-cloud://search?q=...                 -> search pre-filled
///   engram-cloud://timeline                     -> Timeline view
///   engram-cloud://timeline?year=2019           -> Timeline filtered
///   engram-cloud://item/{uuid}                  -> navigate to item
///   engram-cloud://import                       -> Import view
///
/// All commands are gated at the Tauri layer; non-macOS platforms receive
/// no-op responses since deep-link registration only applies on macOS/Windows.
use serde_json::{json, Value};
use tauri::Emitter;

/// Parses and emits a deep-link URL to the frontend.
/// The frontend listener in deeplink.ts does the actual routing.
#[tauri::command]
pub fn handle_deeplink_url(
    app: tauri::AppHandle,
    url: String,
) -> Result<Value, String> {
    let parsed = parse_deeplink_url(&url);
    app.emit("deeplink://navigate", &parsed)
        .map_err(|e| e.to_string())?;
    Ok(json!({ "ok": true, "data": parsed, "error": null }))
}

/// Parses an `engram-cloud://` URL into a structured payload.
pub fn parse_deeplink_url(url: &str) -> Value {
    // Strip the scheme
    let without_scheme = url
        .strip_prefix("engram-cloud://")
        .unwrap_or(url);

    // Split path from query string
    let (path, query) = match without_scheme.find('?') {
        Some(idx) => (&without_scheme[..idx], &without_scheme[idx + 1..]),
        None => (without_scheme, ""),
    };

    // Parse query params into an object
    let mut params = serde_json::Map::new();
    for pair in query.split('&').filter(|s| !s.is_empty()) {
        if let Some(eq) = pair.find('=') {
            let key = &pair[..eq];
            let val = &pair[eq + 1..];
            let decoded = percent_decode(val);
            params.insert(key.to_string(), json!(decoded));
        } else {
            params.insert(pair.to_string(), json!(true));
        }
    }

    // Normalise path: strip leading slash if present
    let route = path.trim_start_matches('/');

    // Extract item UUID if path is "item/{uuid}"
    let (route_name, item_id) = if let Some(uuid) = route.strip_prefix("item/") {
        ("item", Some(uuid.to_string()))
    } else {
        (route, None)
    };

    let mut payload = serde_json::Map::new();
    payload.insert("route".to_string(), json!(route_name));
    payload.insert("params".to_string(), json!(params));
    if let Some(id) = item_id {
        payload.insert("itemId".to_string(), json!(id));
    }

    Value::Object(payload)
}

/// Minimal percent-decode (handles %20 etc.) without pulling in a full URL library.
fn percent_decode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(byte) = u8::from_str_radix(hex, 16) {
                    out.push(byte as char);
                    i += 3;
                    continue;
                }
            }
        } else if bytes[i] == b'+' {
            out.push(' ');
            i += 1;
            continue;
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_new() {
        let v = parse_deeplink_url("engram-cloud://new");
        assert_eq!(v["route"], "new");
    }

    #[test]
    fn test_parse_new_with_cloud() {
        let v = parse_deeplink_url("engram-cloud://new?cloud=memory");
        assert_eq!(v["route"], "new");
        assert_eq!(v["params"]["cloud"], "memory");
    }

    #[test]
    fn test_parse_search() {
        let v = parse_deeplink_url("engram-cloud://search?q=hello%20world");
        assert_eq!(v["route"], "search");
        assert_eq!(v["params"]["q"], "hello world");
    }

    #[test]
    fn test_parse_item() {
        let v = parse_deeplink_url("engram-cloud://item/abc-123");
        assert_eq!(v["route"], "item");
        assert_eq!(v["itemId"], "abc-123");
    }

    #[test]
    fn test_parse_timeline_year() {
        let v = parse_deeplink_url("engram-cloud://timeline?year=2019");
        assert_eq!(v["route"], "timeline");
        assert_eq!(v["params"]["year"], "2019");
    }
}
