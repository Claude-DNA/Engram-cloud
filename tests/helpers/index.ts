import type Database from "better-sqlite3";

export interface Engram {
  id: number;
  title: string;
  content: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

export function clearDatabase(db: Database.Database): void {
  db.exec("DELETE FROM engrams");
  db.exec("DELETE FROM sqlite_sequence WHERE name = 'engrams'");
}

export function createTestEngram(
  db: Database.Database,
  overrides: Partial<Omit<Engram, "id">> = {},
): Engram {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO engrams (title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING *",
  );
  return stmt.get(
    overrides.title ?? "Test Engram",
    overrides.content ?? "Test content",
    overrides.tags ?? "[]",
    overrides.created_at ?? now,
    overrides.updated_at ?? now,
  ) as Engram;
}

export function seedDatabase(
  db: Database.Database,
  engrams: Array<Partial<Omit<Engram, "id">>> = [],
): Engram[] {
  return engrams.map((e) => createTestEngram(db, e));
}
