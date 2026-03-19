import { vi, describe, it, expect, beforeEach } from "vitest";
import { resetMockDb } from "../test/mockDb";

vi.mock("./db", async () => {
  const { createMockDbClient } = await import("../test/mockDb");
  const client = await createMockDbClient();
  return { db: client };
});

const { runMigrations } = await import("./migrations");
const { db } = await import("./db");

describe("runMigrations", () => {
  beforeEach(() => {
    resetMockDb();
  });

  it("creates the _migrations tracking table", async () => {
    await runMigrations();
    const rows = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'", []);
    expect(rows).toHaveLength(1);
  });

  it("records all applied migrations by name", async () => {
    await runMigrations();
    const rows = await db.query("SELECT name FROM _migrations ORDER BY name", []);
    expect(rows).toHaveLength(3);
    expect(rows[0].name).toBe("001_initial");
    expect(rows[1].name).toBe("002_uuid_and_constraints");
    expect(rows[2].name).toBe("003_settings");
  });

  it("is idempotent when run multiple times", async () => {
    await runMigrations();
    await runMigrations();
    const rows = await db.query("SELECT name FROM _migrations", []);
    expect(rows).toHaveLength(3);
  });

  it("creates the persons table from the initial migration", async () => {
    await runMigrations();
    const rows = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='persons'", []);
    expect(rows).toHaveLength(1);
  });
});
