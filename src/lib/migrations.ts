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

/**
 * Splits a SQL string into individual statements, correctly handling
 * triggers and other constructs that contain BEGIN...END blocks.
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let depth = 0;
  let lastCut = 0;

  const re = /\b(BEGIN|END)\b|;/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(sql)) !== null) {
    const token = match[0].toUpperCase();
    if (token === "BEGIN") {
      depth++;
    } else if (token === "END") {
      if (depth > 0) depth--;
    } else if (token === ";" && depth === 0) {
      const stmt = sql.slice(lastCut, match.index).trim();
      if (stmt) statements.push(stmt);
      lastCut = match.index + 1;
    }
  }

  const remaining = sql.slice(lastCut).trim();
  if (remaining) statements.push(remaining);

  return statements;
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

    const statements = splitSqlStatements(migration.sql);

    await db.execute("BEGIN", []);
    let fts5Available = true;
    try {
      for (const stmt of statements) {
        const upperStmt = stmt.toUpperCase();
        const isFtsDependent = upperStmt.includes("_FTS");
        // Skip FTS-dependent statements when FTS5 is not available
        if (isFtsDependent && !fts5Available) {
          continue;
        }
        try {
          await db.execute(stmt, []);
        } catch (stmtErr) {
          const msg = String(stmtErr);
          if (isFtsDependent && (msg.includes("no such module: fts5") || msg.includes("no such table"))) {
            // FTS5 not available in this SQLite build — disable FTS for remaining statements
            fts5Available = false;
            continue;
          }
          throw stmtErr;
        }
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
