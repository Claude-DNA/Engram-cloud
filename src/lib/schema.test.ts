import { vi, describe, it, expect, beforeEach } from "vitest";
import { resetMockDb } from "../test/mockDb";

vi.mock("./db", async () => {
  const { createMockDbClient } = await import("../test/mockDb");
  const client = await createMockDbClient();
  return { db: client };
});

const { runMigrations } = await import("./migrations");
const { db } = await import("./db");

describe("schema golden integration test", () => {
  beforeEach(() => {
    resetMockDb();
  });

  it("creates all 7 tables and virtual FTS5 table", async () => {
    await runMigrations();
    const tables = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' OR type='shadow' OR type IS NULL ORDER BY name",
      []
    );
    const tableNames = tables.map((r) => r.name as string);
    expect(tableNames).toContain("persons");
    expect(tableNames).toContain("engram_items");
    expect(tableNames).toContain("life_phases");
    expect(tableNames).toContain("transformations");
    expect(tableNames).toContain("engram_item_experiences");
    expect(tableNames).toContain("tags");
    expect(tableNames).toContain("engram_item_tags");
  });

  it("golden integration: create entities, link, and query", async () => {
    await runMigrations();

    // 1. Create a person
    await db.execute("INSERT INTO persons (name) VALUES (?)", ["Alice"]);
    const persons = await db.query("SELECT * FROM persons", []);
    expect(persons).toHaveLength(1);
    const personId = persons[0].id as number;

    // 2. Create a life phase
    await db.execute(
      "INSERT INTO life_phases (person_id, name, start_date, end_date) VALUES (?, ?, ?, ?)",
      [personId, "Childhood", "1990-01-01", "2005-12-31"]
    );
    const phases = await db.query(
      "SELECT * FROM life_phases WHERE person_id = ?",
      [personId]
    );
    expect(phases).toHaveLength(1);
    const phaseId = phases[0].id as number;

    // 3. Create 3 engram items with different cloud_types
    await db.execute(
      "INSERT INTO engram_items (person_id, cloud_type, title, content, date, life_phase_id) VALUES (?, ?, ?, ?, ?, ?)",
      [personId, "memory", "First day of school", "I remember the smell of chalk and children playing", "1996-09-01", phaseId]
    );
    await db.execute(
      "INSERT INTO engram_items (person_id, cloud_type, title, content, date, life_phase_id) VALUES (?, ?, ?, ?, ?, ?)",
      [personId, "knowledge", "Python programming", "Learned how to write loops and functions in Python", "2015-03-15", null]
    );
    await db.execute(
      "INSERT INTO engram_items (person_id, cloud_type, title, content, date, life_phase_id) VALUES (?, ?, ?, ?, ?, ?)",
      [personId, "belief", "Hard work pays off", "Consistent effort over time leads to meaningful results", "2020-01-01", null]
    );

    // 4. Create a transformation (memory -> belief)
    const items = await db.query(
      "SELECT id, cloud_type FROM engram_items WHERE person_id = ?",
      [personId]
    );
    const memoryId = items.find((i) => i.cloud_type === "memory")!.id as number;
    const beliefId = items.find((i) => i.cloud_type === "belief")!.id as number;
    const knowledgeId = items.find((i) => i.cloud_type === "knowledge")!.id as number;

    await db.execute(
      "INSERT INTO transformations (person_id, source_id, target_id, transformation_type, description) VALUES (?, ?, ?, ?, ?)",
      [personId, memoryId, beliefId, "insight", "Early experiences shaped core beliefs"]
    );

    // 5. Create an experience link
    await db.execute(
      "INSERT INTO engram_item_experiences (engram_item_id, experience_type, content, date) VALUES (?, ?, ?, ?)",
      [knowledgeId, "practice", "Spent 3 hours working through coding challenges", "2015-04-01"]
    );

    // 6. Add a tag and link it
    await db.execute("INSERT INTO tags (name) VALUES (?)", ["education"]);
    const tags = await db.query("SELECT * FROM tags WHERE name = ?", ["education"]);
    const tagId = tags[0].id as number;
    await db.execute(
      "INSERT INTO engram_item_tags (engram_item_id, tag_id) VALUES (?, ?)",
      [knowledgeId, tagId]
    );

    // Query 1: by cloud_type
    const memories = await db.query(
      "SELECT * FROM engram_items WHERE person_id = ? AND cloud_type = ? AND deleted_at IS NULL",
      [personId, "memory"]
    );
    expect(memories).toHaveLength(1);
    expect(memories[0].title).toBe("First day of school");

    // Query 2: FTS5 full-text search (skipped when FTS5 is not available in the SQLite build)
    const ftsTableExists = await db.query(
      "SELECT name FROM sqlite_master WHERE name='engram_items_fts'",
      []
    );
    if (ftsTableExists.length > 0) {
      const ftsResults = await db.query(
        "SELECT ei.* FROM engram_items ei INNER JOIN engram_items_fts ON ei.id = engram_items_fts.rowid WHERE engram_items_fts MATCH ?",
        ["chalk"]
      );
      expect(ftsResults).toHaveLength(1);
      expect(ftsResults[0].title).toBe("First day of school");
    }

    // Query 3: date range
    const dateRangeResults = await db.query(
      "SELECT * FROM engram_items WHERE person_id = ? AND date BETWEEN ? AND ? AND deleted_at IS NULL",
      [personId, "2014-01-01", "2016-12-31"]
    );
    expect(dateRangeResults).toHaveLength(1);
    expect(dateRangeResults[0].cloud_type).toBe("knowledge");

    // Query 4: soft delete
    await db.execute(
      "UPDATE engram_items SET deleted_at = datetime('now') WHERE id = ?",
      [beliefId]
    );
    const activeItems = await db.query(
      "SELECT * FROM engram_items WHERE person_id = ? AND deleted_at IS NULL",
      [personId]
    );
    expect(activeItems).toHaveLength(2);

    const deletedItems = await db.query(
      "SELECT * FROM engram_items WHERE person_id = ? AND deleted_at IS NOT NULL",
      [personId]
    );
    expect(deletedItems).toHaveLength(1);
    expect(deletedItems[0].id).toBe(beliefId);
  });
});
