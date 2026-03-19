use argon2::{Algorithm, Argon2, Params, Version};
use rand::RngCore;
use rusqlite::{
    types::{ToSql, ToSqlOutput, Value as SqlValue},
    Connection, Row,
};
use security_framework::passwords::{get_generic_password, set_generic_password};
use serde_json::{json, Value};
use std::path::Path;
use zeroize::{Zeroize, Zeroizing};

pub struct EncryptedDb {
    conn: Option<Connection>,
    key: Zeroizing<Vec<u8>>,
}

// ── Param helpers ─────────────────────────────────────────────────────────────

enum SqlParam {
    Text(String),
    Integer(i64),
    Real(f64),
    Null,
}

impl ToSql for SqlParam {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        match self {
            SqlParam::Text(s) => Ok(ToSqlOutput::Owned(SqlValue::Text(s.clone()))),
            SqlParam::Integer(i) => Ok(ToSqlOutput::Owned(SqlValue::Integer(*i))),
            SqlParam::Real(f) => Ok(ToSqlOutput::Owned(SqlValue::Real(*f))),
            SqlParam::Null => Ok(ToSqlOutput::Owned(SqlValue::Null)),
        }
    }
}

fn json_to_sql_param(v: &Value) -> SqlParam {
    match v {
        Value::String(s) => SqlParam::Text(s.clone()),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                SqlParam::Integer(i)
            } else if let Some(f) = n.as_f64() {
                SqlParam::Real(f)
            } else {
                SqlParam::Null
            }
        }
        Value::Bool(b) => SqlParam::Integer(if *b { 1 } else { 0 }),
        Value::Null => SqlParam::Null,
        _ => SqlParam::Text(v.to_string()),
    }
}

fn row_to_json(row: &Row, col_names: &[String]) -> rusqlite::Result<Value> {
    let mut map = serde_json::Map::new();
    for (i, name) in col_names.iter().enumerate() {
        let val: SqlValue = row.get(i)?;
        let json_val = match val {
            SqlValue::Null => Value::Null,
            SqlValue::Integer(n) => json!(n),
            SqlValue::Real(f) => json!(f),
            SqlValue::Text(s) => Value::String(s),
            SqlValue::Blob(b) => Value::String(b.iter().map(|byte| format!("{byte:02x}")).collect()),
        };
        map.insert(name.clone(), json_val);
    }
    Ok(Value::Object(map))
}

// ── EncryptedDb ───────────────────────────────────────────────────────────────

impl EncryptedDb {
    pub fn new() -> Self {
        Self {
            conn: None,
            key: Zeroizing::new(vec![]),
        }
    }

    // ── Salt / key derivation ─────────────────────────────────────────────────

    fn get_or_create_salt() -> Result<Vec<u8>, String> {
        // Try keychain first, fall back to file-based salt (dev builds may lack entitlements)
        match get_generic_password("engram-cloud", "db-encryption-salt") {
            Ok(salt) => return Ok(salt),
            Err(_) => {}
        }

        // Check file-based fallback
        let salt_dir = dirs::data_dir()
            .ok_or("No data directory")?
            .join("cloud.engram.app");
        let salt_path = salt_dir.join("encryption.salt");

        if salt_path.exists() {
            return std::fs::read(&salt_path)
                .map_err(|e| format!("Failed to read salt file: {e}"));
        }

        // Generate new salt
        let mut salt = vec![0u8; 32];
        rand::thread_rng().fill_bytes(&mut salt);

        // Try keychain, fall back to file
        match set_generic_password("engram-cloud", "db-encryption-salt", &salt) {
            Ok(_) => {}
            Err(_) => {
                std::fs::create_dir_all(&salt_dir)
                    .map_err(|e| format!("Failed to create salt directory: {e}"))?;
                std::fs::write(&salt_path, &salt)
                    .map_err(|e| format!("Failed to write salt file: {e}"))?;
                println!("Salt stored in file (keychain unavailable in dev mode)");
            }
        }
        Ok(salt)
    }

    fn derive_key(passphrase: &str, salt: &[u8]) -> Result<Zeroizing<Vec<u8>>, String> {
        let params = Params::new(65536, 3, 4, Some(32))
            .map_err(|e| format!("Argon2 params error: {e}"))?;
        let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
        let mut key = Zeroizing::new(vec![0u8; 32]);
        argon2
            .hash_password_into(passphrase.as_bytes(), salt, &mut key)
            .map_err(|e| format!("Key derivation failed: {e}"))?;
        Ok(key)
    }

    fn key_hex(key: &[u8]) -> String {
        key.iter().map(|b| format!("{b:02x}")).collect()
    }

    // ── DB open helpers ───────────────────────────────────────────────────────

    /// Returns true if the file looks like a plaintext SQLite database.
    fn is_unencrypted(db_path: &Path) -> bool {
        use std::io::Read;
        if let Ok(mut f) = std::fs::File::open(db_path) {
            let mut header = [0u8; 16];
            if f.read_exact(&mut header).is_ok() {
                return &header == b"SQLite format 3\0";
            }
        }
        false
    }

    /// Use sqlcipher_export to copy a plaintext DB into a new encrypted file,
    /// then swap it into place.
    fn migrate_to_encrypted(db_path: &Path, key: &[u8]) -> Result<(), String> {
        let key_hex = Self::key_hex(key);
        let new_path = db_path.with_extension("db.new");
        let new_path_str = new_path.to_string_lossy();

        let old_conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open source database: {e}"))?;

        old_conn
            .execute_batch(&format!(
                "ATTACH DATABASE '{new_path_str}' AS encrypted KEY \"x'{key_hex}'\"; \
                 SELECT sqlcipher_export('encrypted'); \
                 DETACH DATABASE encrypted;"
            ))
            .map_err(|e| format!("Migration to encrypted database failed: {e}"))?;

        drop(old_conn);

        let backup_path = db_path.with_extension("db.backup");
        std::fs::rename(db_path, &backup_path)
            .map_err(|e| format!("Failed to backup plaintext database: {e}"))?;
        std::fs::rename(&new_path, db_path)
            .map_err(|e| format!("Failed to place encrypted database: {e}"))?;

        println!("Database migrated to encrypted format successfully");
        Ok(())
    }

    fn open_connection(db_path: &Path, key: &[u8]) -> Result<Connection, String> {
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database: {e}"))?;

        let key_hex = Self::key_hex(key);
        conn.execute_batch(&format!("PRAGMA key = \"x'{key_hex}'\";"))
            .map_err(|e| format!("Failed to set database key: {e}"))?;

        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| format!("Failed to set journal mode: {e}"))?;

        // Verify the key is correct — wrong key causes garbled reads, not an error
        conn.execute_batch("SELECT count(*) FROM sqlite_master;")
            .map_err(|_| "Invalid passphrase or corrupted database".to_string())?;

        Ok(conn)
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// Derive key from passphrase, migrate if needed, open the encrypted DB.
    pub fn open(&mut self, db_path: &Path, passphrase: &str) -> Result<(), String> {
        let salt = Self::get_or_create_salt()?;
        let key = Self::derive_key(passphrase, &salt)?;

        if db_path.exists() && Self::is_unencrypted(db_path) {
            Self::migrate_to_encrypted(db_path, &key)?;
        }

        let conn = Self::open_connection(db_path, &key)?;

        // Cache derived key in keychain so biometric unlock can reuse it (ignore failure in dev)
        let _ = set_generic_password("engram-cloud", "db-key", &key);

        self.key = key;
        self.conn = Some(conn);
        Ok(())
    }

    /// Open using a raw key retrieved from keychain (biometric path).
    pub fn open_with_key(&mut self, db_path: &Path, key: Zeroizing<Vec<u8>>) -> Result<(), String> {
        let conn = Self::open_connection(db_path, &key)?;
        self.key = key;
        self.conn = Some(conn);
        Ok(())
    }

    /// Retrieve cached key from keychain and open the DB (biometric unlock).
    pub fn open_biometric(&mut self, db_path: &Path) -> Result<(), String> {
        let raw_key = get_generic_password("engram-cloud", "db-key")
            .map_err(|_| {
                "No cached key found. Please unlock with your passphrase at least once.".to_string()
            })?;
        self.open_with_key(db_path, Zeroizing::new(raw_key))
    }

    /// Delete the existing DB file and create a fresh encrypted one (used after
    /// passphrase reset via recovery key, where old ciphertext is unrecoverable).
    pub fn reset_and_open(&mut self, db_path: &Path, passphrase: &str) -> Result<(), String> {
        // Close any open connection first
        self.conn = None;

        // Remove old DB files
        for suffix in &["", ".backup", "-wal", "-shm"] {
            let p = if suffix.is_empty() {
                db_path.to_path_buf()
            } else {
                let mut s = db_path.as_os_str().to_owned();
                s.push(suffix);
                std::path::PathBuf::from(s)
            };
            let _ = std::fs::remove_file(&p);
        }

        self.open(db_path, passphrase)
    }

    /// Zero the key and drop the connection (app lock).
    pub fn close(&mut self) {
        self.conn = None;
        self.key = Zeroizing::new(vec![]);
    }

    // ── SQL operations ────────────────────────────────────────────────────────

    pub fn execute_sql(&self, sql: &str, params: &[Value]) -> Value {
        let result: Result<Value, String> = (|| {
            let conn = self
                .conn
                .as_ref()
                .ok_or("Database is locked. Please unlock the app first.")?;

            let sql_params: Vec<SqlParam> = params.iter().map(json_to_sql_param).collect();
            let param_refs: Vec<&dyn ToSql> =
                sql_params.iter().map(|p| p as &dyn ToSql).collect();

            let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
            let rows_affected = stmt
                .execute(param_refs.as_slice())
                .map_err(|e| e.to_string())?;

            Ok(json!({
                "ok": true,
                "data": { "rows_affected": rows_affected },
                "error": null
            }))
        })();

        match result {
            Ok(v) => v,
            Err(e) => json!({ "ok": false, "data": null, "error": e }),
        }
    }

    pub fn query_sql(&self, sql: &str, params: &[Value]) -> Value {
        let result: Result<Value, String> = (|| {
            let conn = self
                .conn
                .as_ref()
                .ok_or("Database is locked. Please unlock the app first.")?;

            let sql_params: Vec<SqlParam> = params.iter().map(json_to_sql_param).collect();
            let param_refs: Vec<&dyn ToSql> =
                sql_params.iter().map(|p| p as &dyn ToSql).collect();

            let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

            let col_count = stmt.column_count();
            let col_names: Vec<String> = (0..col_count)
                .map(|i| stmt.column_name(i).unwrap_or("").to_string())
                .collect();

            let mapped = stmt
                .query_map(param_refs.as_slice(), |row| row_to_json(row, &col_names))
                .map_err(|e| e.to_string())?;

            let rows: Vec<Value> = mapped
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(|e| e.to_string())?;

            Ok(json!({
                "ok": true,
                "data": rows,
                "error": null
            }))
        })();

        match result {
            Ok(v) => v,
            Err(e) => json!({ "ok": false, "data": null, "error": e }),
        }
    }
}

impl Drop for EncryptedDb {
    fn drop(&mut self) {
        self.conn = None;
        self.key.zeroize();
    }
}
