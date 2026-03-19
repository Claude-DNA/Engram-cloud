mod auth;

use serde_json::{json, Value};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteRow},
    Column, Row, SqlitePool, TypeInfo,
};
use std::str::FromStr;
use tauri::Manager;

struct DbState(SqlitePool);

fn row_to_json(row: &SqliteRow) -> Value {
    let mut map = serde_json::Map::new();
    for (i, col) in row.columns().iter().enumerate() {
        let key = col.name().to_string();
        let type_name = col.type_info().name().to_uppercase();
        let value = if type_name.contains("INT") {
            row.try_get::<Option<i64>, _>(i)
                .ok()
                .flatten()
                .map(|v| json!(v))
                .unwrap_or(Value::Null)
        } else if type_name == "REAL"
            || type_name.contains("FLOAT")
            || type_name.contains("DOUBLE")
        {
            row.try_get::<Option<f64>, _>(i)
                .ok()
                .flatten()
                .map(|v| json!(v))
                .unwrap_or(Value::Null)
        } else {
            row.try_get::<Option<String>, _>(i)
                .ok()
                .flatten()
                .map(Value::String)
                .unwrap_or(Value::Null)
        };
        map.insert(key, value);
    }
    Value::Object(map)
}

fn bind_param<'q>(
    query: sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>>,
    param: Value,
) -> sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>> {
    match param {
        Value::String(s) => query.bind(s),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                query.bind(i)
            } else if let Some(f) = n.as_f64() {
                query.bind(f)
            } else {
                query.bind::<Option<String>>(None)
            }
        }
        Value::Bool(b) => query.bind(b),
        Value::Null => query.bind::<Option<String>>(None),
        _ => query.bind(param.to_string()),
    }
}

#[tauri::command]
async fn db_execute(
    state: tauri::State<'_, DbState>,
    sql: String,
    params: Vec<Value>,
) -> Result<Value, String> {
    let pool = &state.0;
    let mut query = sqlx::query(&sql);
    for param in params {
        query = bind_param(query, param);
    }
    match query.execute(pool).await {
        Ok(result) => Ok(json!({
            "ok": true,
            "data": { "rows_affected": result.rows_affected() },
            "error": null
        })),
        Err(e) => Ok(json!({
            "ok": false,
            "data": null,
            "error": e.to_string()
        })),
    }
}

#[tauri::command]
async fn db_query(
    state: tauri::State<'_, DbState>,
    sql: String,
    params: Vec<Value>,
) -> Result<Value, String> {
    let pool = &state.0;
    let mut query = sqlx::query(&sql);
    for param in params {
        query = bind_param(query, param);
    }
    match query.fetch_all(pool).await {
        Ok(rows) => {
            let data: Vec<Value> = rows.iter().map(row_to_json).collect();
            Ok(json!({
                "ok": true,
                "data": data,
                "error": null
            }))
        }
        Err(e) => Ok(json!({
            "ok": false,
            "data": null,
            "error": e.to_string()
        })),
    }
}

#[tauri::command]
async fn db_get_path(app: tauri::AppHandle) -> Result<Value, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("engram.db");
    Ok(json!({
        "ok": true,
        "data": db_path.to_string_lossy(),
        "error": null
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("No app data directory");
            std::fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("engram.db");

            let db_url = format!("sqlite:{}", db_path.display());
            let opts = SqliteConnectOptions::from_str(&db_url)
                .expect("Invalid database URL")
                .create_if_missing(true)
                .journal_mode(SqliteJournalMode::Wal);

            let pool = tauri::async_runtime::block_on(
                SqlitePoolOptions::new()
                    .max_connections(1)
                    .connect_with(opts),
            )
            .expect("Failed to open database");

            println!("Database initialized at {}", db_path.display());

            app.manage(DbState(pool));

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
            auth::create_passphrase,
            auth::verify_passphrase,
            auth::has_passphrase,
            auth::get_cooldown_remaining,
            auth::check_biometric_availability,
            auth::biometric_authenticate,
            auth::generate_recovery_key,
            auth::store_recovery_data,
            auth::recover_with_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
