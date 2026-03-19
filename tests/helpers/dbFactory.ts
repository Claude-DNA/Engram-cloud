import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import initialSql from "../../src/migrations/001_initial.sql?raw";

export interface TestDatabase {
  db: Database.Database;
  path: string;
  cleanup: () => void;
}

export function createTestDatabase(): TestDatabase {
  const dir = mkdtempSync(join(tmpdir(), "engram-test-"));
  const path = join(dir, "test.db");
  const db = new Database(path);

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )
  `);

  if (initialSql.trim()) {
    db.exec(initialSql);
  }

  return {
    db,
    path,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
