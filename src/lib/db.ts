import { invoke } from "@tauri-apps/api/core";

interface DbResponse<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

interface ExecuteResult {
  rows_affected: number;
}

export type Row = Record<string, unknown>;

export interface DbClient {
  execute(sql: string, params?: unknown[]): Promise<{ rows_affected: number }>;
  query(sql: string, params?: unknown[]): Promise<Row[]>;
}

async function execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
  const res = await invoke<DbResponse<ExecuteResult>>("db_execute", { sql, params });
  if (!res.ok) throw new Error(res.error ?? "Database execute error");
  return res.data!;
}

async function query(sql: string, params: unknown[] = []): Promise<Row[]> {
  const res = await invoke<DbResponse<Row[]>>("db_query", { sql, params });
  if (!res.ok) throw new Error(res.error ?? "Database query error");
  return res.data ?? [];
}

async function getPath(): Promise<string> {
  const res = await invoke<DbResponse<string>>("db_get_path");
  if (!res.ok) throw new Error(res.error ?? "Failed to get database path");
  return res.data!;
}

export const db = { execute, query, getPath };
