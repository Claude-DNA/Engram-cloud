-- persons: the individual whose engrams we store
CREATE TABLE IF NOT EXISTS persons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

-- life_phases: named periods in a person's life
CREATE TABLE IF NOT EXISTS life_phases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id   INTEGER NOT NULL REFERENCES persons(id),
  name        TEXT    NOT NULL,
  start_date  TEXT    NOT NULL,
  end_date    TEXT,
  description TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- engram_items: the core memory/knowledge/belief/etc items
CREATE TABLE IF NOT EXISTS engram_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id     INTEGER NOT NULL REFERENCES persons(id),
  cloud_type    TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  content       TEXT    NOT NULL,
  date          TEXT,
  life_phase_id INTEGER REFERENCES life_phases(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);

-- transformations: directed links showing how one engram transformed into another
CREATE TABLE IF NOT EXISTS transformations (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id           INTEGER NOT NULL REFERENCES persons(id),
  source_id           INTEGER NOT NULL REFERENCES engram_items(id),
  target_id           INTEGER NOT NULL REFERENCES engram_items(id),
  transformation_type TEXT    NOT NULL,
  description         TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- engram_item_experiences: lived experiences linked to an engram item
CREATE TABLE IF NOT EXISTS engram_item_experiences (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  engram_item_id  INTEGER NOT NULL REFERENCES engram_items(id),
  experience_type TEXT    NOT NULL,
  content         TEXT    NOT NULL,
  date            TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- tags: reusable labels
CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- engram_item_tags: many-to-many junction
CREATE TABLE IF NOT EXISTS engram_item_tags (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  engram_item_id INTEGER NOT NULL REFERENCES engram_items(id),
  tag_id         INTEGER NOT NULL REFERENCES tags(id),
  UNIQUE(engram_item_id, tag_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_engram_items_person_id     ON engram_items(person_id);
CREATE INDEX IF NOT EXISTS idx_engram_items_cloud_type    ON engram_items(cloud_type);
CREATE INDEX IF NOT EXISTS idx_engram_items_life_phase_id ON engram_items(life_phase_id);
CREATE INDEX IF NOT EXISTS idx_engram_items_date          ON engram_items(date);
CREATE INDEX IF NOT EXISTS idx_engram_items_deleted_at    ON engram_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_life_phases_person_id      ON life_phases(person_id);
CREATE INDEX IF NOT EXISTS idx_transformations_source_id  ON transformations(source_id);
CREATE INDEX IF NOT EXISTS idx_transformations_target_id  ON transformations(target_id);
CREATE INDEX IF NOT EXISTS idx_experiences_engram_item_id ON engram_item_experiences(engram_item_id);
CREATE INDEX IF NOT EXISTS idx_engram_item_tags_tag_id    ON engram_item_tags(tag_id);

-- FTS5 virtual table for full-text search on engram_items
CREATE VIRTUAL TABLE IF NOT EXISTS engram_items_fts USING fts5(
  title,
  content,
  content='engram_items',
  content_rowid='id'
);

-- FTS5 sync triggers
CREATE TRIGGER engram_items_fts_insert AFTER INSERT ON engram_items BEGIN
  INSERT INTO engram_items_fts(rowid, title, content) VALUES (NEW.id, NEW.title, NEW.content);
END;

CREATE TRIGGER engram_items_fts_delete BEFORE DELETE ON engram_items BEGIN
  INSERT INTO engram_items_fts(engram_items_fts, rowid, title, content) VALUES ('delete', OLD.id, OLD.title, OLD.content);
END;

CREATE TRIGGER engram_items_fts_update AFTER UPDATE ON engram_items BEGIN
  INSERT INTO engram_items_fts(engram_items_fts, rowid, title, content) VALUES ('delete', OLD.id, OLD.title, OLD.content);
  INSERT INTO engram_items_fts(rowid, title, content) VALUES (NEW.id, NEW.title, NEW.content);
END;

-- updated_at triggers
CREATE TRIGGER persons_updated_at AFTER UPDATE ON persons BEGIN
  UPDATE persons SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER life_phases_updated_at AFTER UPDATE ON life_phases BEGIN
  UPDATE life_phases SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER engram_items_updated_at AFTER UPDATE ON engram_items BEGIN
  UPDATE engram_items SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER transformations_updated_at AFTER UPDATE ON transformations BEGIN
  UPDATE transformations SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER engram_item_experiences_updated_at AFTER UPDATE ON engram_item_experiences BEGIN
  UPDATE engram_item_experiences SET updated_at = datetime('now') WHERE id = OLD.id;
END;
