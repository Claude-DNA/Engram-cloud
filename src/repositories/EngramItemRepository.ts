import type { DbClient, Row } from '../lib/db';
import { db as defaultDb } from '../lib/db';
import { generateUUIDv7 } from '../lib/uuid';
import type { CloudType, EngramItem } from '../types/engram';

export interface EngramItemFilters {
  person_id?: number;
  cloud_type?: CloudType;
  life_phase_id?: number;
  date_from?: string;
  date_to?: string;
}

function rowToEngramItem(row: Row): EngramItem {
  return {
    id: row.id as number,
    person_id: row.person_id as number,
    cloud_type: row.cloud_type as CloudType,
    title: row.title as string,
    content: row.content as string,
    date: (row.date as string | null) ?? null,
    life_phase_id: (row.life_phase_id as number | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string | null) ?? null,
  } as EngramItem;
}

export class EngramItemRepository {
  constructor(private readonly client: DbClient) {}

  async create(data: {
    person_id: number;
    cloud_type: CloudType;
    title: string;
    content: string;
    date?: string | null;
    life_phase_id?: number | null;
  }): Promise<EngramItem> {
    const _uuid = generateUUIDv7();
    await this.client.execute(
      'INSERT INTO engram_items (person_id, cloud_type, title, content, date, life_phase_id) VALUES (?, ?, ?, ?, ?, ?)',
      [
        data.person_id,
        data.cloud_type,
        data.title,
        data.content,
        data.date ?? null,
        data.life_phase_id ?? null,
      ],
    );
    const rows = await this.client.query(
      'SELECT * FROM engram_items WHERE id = last_insert_rowid()',
      [],
    );
    return rowToEngramItem(rows[0]);
  }

  async findById(id: number): Promise<EngramItem | null> {
    const rows = await this.client.query(
      'SELECT * FROM engram_items WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return rows.length > 0 ? rowToEngramItem(rows[0]) : null;
  }

  async update(
    id: number,
    data: Partial<{
      title: string;
      content: string;
      date: string | null;
      life_phase_id: number | null;
      cloud_type: CloudType;
    }>,
  ): Promise<EngramItem | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (data.title !== undefined) {
      setClauses.push('title = ?');
      params.push(data.title);
    }
    if (data.content !== undefined) {
      setClauses.push('content = ?');
      params.push(data.content);
    }
    if (data.date !== undefined) {
      setClauses.push('date = ?');
      params.push(data.date);
    }
    if (data.life_phase_id !== undefined) {
      setClauses.push('life_phase_id = ?');
      params.push(data.life_phase_id);
    }
    if (data.cloud_type !== undefined) {
      setClauses.push('cloud_type = ?');
      params.push(data.cloud_type);
    }

    if (setClauses.length === 0) return this.findById(id);

    params.push(id);
    await this.client.execute(
      `UPDATE engram_items SET ${setClauses.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      params,
    );
    return this.findById(id);
  }

  async softDelete(id: number): Promise<void> {
    await this.client.execute(
      "UPDATE engram_items SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
      [id],
    );
  }

  async list(filters: EngramItemFilters = {}): Promise<EngramItem[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (filters.person_id !== undefined) {
      conditions.push('person_id = ?');
      params.push(filters.person_id);
    }
    if (filters.cloud_type !== undefined) {
      conditions.push('cloud_type = ?');
      params.push(filters.cloud_type);
    }
    if (filters.life_phase_id !== undefined) {
      conditions.push('life_phase_id = ?');
      params.push(filters.life_phase_id);
    }
    if (filters.date_from !== undefined) {
      conditions.push('date >= ?');
      params.push(filters.date_from);
    }
    if (filters.date_to !== undefined) {
      conditions.push('date <= ?');
      params.push(filters.date_to);
    }

    const sql = `SELECT * FROM engram_items WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    const rows = await this.client.query(sql, params);
    return rows.map(rowToEngramItem);
  }

  async search(query: string, personId?: number): Promise<EngramItem[]> {
    const pattern = `%${query}%`;
    const conditions: string[] = [
      'deleted_at IS NULL',
      '(title LIKE ? OR content LIKE ?)',
    ];
    const params: unknown[] = [pattern, pattern];

    if (personId !== undefined) {
      conditions.push('person_id = ?');
      params.push(personId);
    }

    const sql = `SELECT * FROM engram_items WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    const rows = await this.client.query(sql, params);
    return rows.map(rowToEngramItem);
  }
}

export const engramItemRepository = new EngramItemRepository(defaultDb);
