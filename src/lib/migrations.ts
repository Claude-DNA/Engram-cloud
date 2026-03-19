import { db } from "./db";

const migrationModules = import.meta.glob("../migrations/*.sql", {
  as: "raw",
  eager: true,
}) as Record<string, string>;

interface Migration {
  name: string;
  sql: string;
}

function getMigrations(): Migration[] {
  return Object.entries(migrationModules)
    .map(([path, sql]) => ({
      name: path.split("/").pop()!.replace(".sql", ""),
      sql,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function runMigrations(): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )`,
    [],
  );

  const applied = await db.query("SELECT name FROM _migrations", []);
  const appliedNames = new Set(applied.map((r) => r.name as string));

  const migrations = getMigrations();

  for (const migration of migrations) {
    if (appliedNames.has(migration.name)) continue;

    const ts = new Date().toISOString();
    console.log(`[${ts}] Running migration: ${migration.name}`);

    const statements = migration.sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    await db.execute("BEGIN", []);
    try {
      for (const stmt of statements) {
        await db.execute(stmt, []);
      }
      await db.execute(
        "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
        [migration.name, ts],
      );
      await db.execute("COMMIT", []);
      console.log(`[${ts}] Migration applied: ${migration.name}`);
    } catch (err) {
      await db.execute("ROLLBACK", []);
      throw new Error(`Migration ${migration.name} failed: ${err}`);
    }
  }

  const path = await db.getPath();
  console.log(`Database initialized at ${path}`);
}
