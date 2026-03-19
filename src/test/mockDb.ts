import initSqlJs from "sql.js";
import type { Database, SqlValue } from "sql.js";
import type { Row } from "../lib/db";

let _db: Database | null = null;
let _sqlModule: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function getSqlModule() {
  if (!_sqlModule) {
    _sqlModule = await initSqlJs();
  }
  return _sqlModule;
}

async function getDb(): Promise<Database> {
  if (!_db) {
    const SQL = await getSqlModule();
    _db = new SQL.Database();
  }
  return _db;
}

export function resetMockDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export async function createMockDbClient() {
  async function execute(sql: string, params: unknown[] = []): Promise<{ rows_affected: number }> {
    const database = await getDb();
    database.run(sql, params as SqlValue[]);
    return { rows_affected: database.getRowsModified() };
  }

  async function query(sql: string, params: unknown[] = []): Promise<Row[]> {
    const database = await getDb();
    const stmt = database.prepare(sql);
    stmt.bind(params as SqlValue[]);
    const rows: Row[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as Row);
    }
    stmt.free();
    return rows;
  }

  async function getPath(): Promise<string> {
    return ":memory:";
  }

  return { execute, query, getPath };
}
