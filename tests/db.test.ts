import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase, type TestDatabase } from "./helpers/dbFactory";
import { createTestEngram, clearDatabase, seedDatabase } from "./helpers";

describe("database integration helpers", () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("createTestDatabase creates a database with the engrams table", () => {
    const row = testDb.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='engrams'")
      .get();
    expect(row).toBeDefined();
  });

  it("createTestEngram inserts a record and returns it with an id", () => {
    const engram = createTestEngram(testDb.db, { title: "Memory 1", content: "Hello world" });
    expect(engram.id).toBeGreaterThan(0);
    expect(engram.title).toBe("Memory 1");
    expect(engram.content).toBe("Hello world");
    expect(engram.tags).toBe("[]");
  });

  it("createTestEngram uses default values when no overrides are given", () => {
    const engram = createTestEngram(testDb.db);
    expect(engram.title).toBe("Test Engram");
    expect(engram.content).toBe("Test content");
  });

  it("clearDatabase removes all engrams", () => {
    createTestEngram(testDb.db);
    createTestEngram(testDb.db);
    clearDatabase(testDb.db);
    const count = testDb.db.prepare("SELECT COUNT(*) as count FROM engrams").get() as {
      count: number;
    };
    expect(count.count).toBe(0);
  });

  it("seedDatabase inserts multiple engrams and returns them", () => {
    const engrams = seedDatabase(testDb.db, [
      { title: "Engram A", content: "Content A" },
      { title: "Engram B", content: "Content B" },
      { title: "Engram C", content: "Content C" },
    ]);
    expect(engrams).toHaveLength(3);
    expect(engrams[0].title).toBe("Engram A");
    expect(engrams[2].title).toBe("Engram C");
  });

  it("each test gets a fresh isolated database", () => {
    createTestEngram(testDb.db, { title: "Isolated" });
    const count = testDb.db.prepare("SELECT COUNT(*) as count FROM engrams").get() as {
      count: number;
    };
    expect(count.count).toBe(1);
  });
});
