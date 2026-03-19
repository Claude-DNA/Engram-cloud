import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase, type TestDatabase } from "./helpers/dbFactory";
import { createTestPerson, createTestEngramItem, clearDatabase, seedDatabase } from "./helpers";

describe("database integration helpers", () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("createTestDatabase creates a database with the persons table", () => {
    const row = testDb.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='persons'")
      .get();
    expect(row).toBeDefined();
  });

  it("createTestPerson inserts a record and returns it with an id", () => {
    const person = createTestPerson(testDb.db, { name: "Alice" });
    expect(person.id).toBeGreaterThan(0);
    expect(person.name).toBe("Alice");
  });

  it("createTestPerson uses default values when no overrides are given", () => {
    const person = createTestPerson(testDb.db);
    expect(person.name).toBe("Test Person");
  });

  it("createTestEngramItem inserts a record and returns it with an id", () => {
    const person = createTestPerson(testDb.db);
    const item = createTestEngramItem(testDb.db, person.id, { title: "Memory 1", content: "Hello world" });
    expect(item.id).toBeGreaterThan(0);
    expect(item.title).toBe("Memory 1");
    expect(item.content).toBe("Hello world");
    expect(item.cloud_type).toBe("memory");
    expect(item.person_id).toBe(person.id);
  });

  it("clearDatabase removes all engram_items and persons", () => {
    const person = createTestPerson(testDb.db);
    createTestEngramItem(testDb.db, person.id);
    createTestEngramItem(testDb.db, person.id);
    clearDatabase(testDb.db);
    const count = testDb.db.prepare("SELECT COUNT(*) as count FROM engram_items").get() as {
      count: number;
    };
    expect(count.count).toBe(0);
    const personCount = testDb.db.prepare("SELECT COUNT(*) as count FROM persons").get() as {
      count: number;
    };
    expect(personCount.count).toBe(0);
  });

  it("seedDatabase inserts multiple engram items and returns them", () => {
    const person = createTestPerson(testDb.db);
    const items = seedDatabase(testDb.db, [
      { personId: person.id, overrides: { title: "Engram A", content: "Content A" } },
      { personId: person.id, overrides: { title: "Engram B", content: "Content B" } },
      { personId: person.id, overrides: { title: "Engram C", content: "Content C" } },
    ]);
    expect(items).toHaveLength(3);
    expect(items[0].title).toBe("Engram A");
    expect(items[2].title).toBe("Engram C");
  });

  it("each test gets a fresh isolated database", () => {
    const person = createTestPerson(testDb.db, { name: "Isolated" });
    createTestEngramItem(testDb.db, person.id);
    const count = testDb.db.prepare("SELECT COUNT(*) as count FROM engram_items").get() as {
      count: number;
    };
    expect(count.count).toBe(1);
  });
});
