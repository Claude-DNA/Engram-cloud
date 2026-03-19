import type { DbClient, Row } from '../lib/db';
import { db as defaultDb } from '../lib/db';

export class SettingsRepository {
  constructor(private readonly client: DbClient) {}

  async get(key: string): Promise<string | null> {
    const rows = await this.client.query(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    );
    return rows.length > 0 ? (rows[0].value as string | null) : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.execute(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.execute('DELETE FROM settings WHERE key = ?', [key]);
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.client.query('SELECT key, value FROM settings', []);
    const result: Record<string, string> = {};
    for (const row of rows) {
      if (row.value !== null) {
        result[row.key as string] = row.value as string;
      }
    }
    return result;
  }
}

export const settingsRepository = new SettingsRepository(defaultDb);
