CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER settings_updated_at AFTER UPDATE ON settings BEGIN
  UPDATE settings SET updated_at = datetime('now') WHERE key = OLD.key;
END;
