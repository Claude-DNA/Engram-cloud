import type Database from "better-sqlite3";

export interface Person {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EngramItem {
  id: number;
  person_id: number;
  cloud_type: string;
  title: string;
  content: string;
  date: string | null;
  life_phase_id: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function clearDatabase(db: Database.Database): void {
  db.exec("DELETE FROM engram_item_tags");
  db.exec("DELETE FROM tags");
  db.exec("DELETE FROM engram_item_experiences");
  db.exec("DELETE FROM transformations");
  db.exec("DELETE FROM engram_items");
  db.exec("DELETE FROM life_phases");
  db.exec("DELETE FROM persons");
}

export function createTestPerson(
  db: Database.Database,
  overrides: Partial<Omit<Person, "id">> = {},
): Person {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO persons (name, created_at, updated_at) VALUES (?, ?, ?) RETURNING *",
  );
  return stmt.get(
    overrides.name ?? "Test Person",
    overrides.created_at ?? now,
    overrides.updated_at ?? now,
  ) as Person;
}

export function createTestEngramItem(
  db: Database.Database,
  personId: number,
  overrides: Partial<Omit<EngramItem, "id" | "person_id">> = {},
): EngramItem {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO engram_items (person_id, cloud_type, title, content, date, life_phase_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
  );
  return stmt.get(
    personId,
    overrides.cloud_type ?? "memory",
    overrides.title ?? "Test Engram",
    overrides.content ?? "Test content",
    overrides.date ?? null,
    overrides.life_phase_id ?? null,
    overrides.created_at ?? now,
    overrides.updated_at ?? now,
  ) as EngramItem;
}

export function seedDatabase(
  db: Database.Database,
  items: Array<{ personId: number; overrides?: Partial<Omit<EngramItem, "id" | "person_id">> }> = [],
): EngramItem[] {
  return items.map(({ personId, overrides }) => createTestEngramItem(db, personId, overrides));
}
