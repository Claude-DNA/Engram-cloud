import type { DbClient, Row } from '../lib/db';
import { db as defaultDb } from '../lib/db';
import { generateUUIDv7 } from '../lib/uuid';
import type { EngramItemExperience } from '../types/engram';

function rowToExperience(row: Row): EngramItemExperience {
  return {
    id: row.id as number,
    engram_item_id: row.engram_item_id as number,
    experience_type: row.experience_type as string,
    content: row.content as string,
    date: (row.date as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export class ExperienceLinksRepository {
  constructor(private readonly client: DbClient) {}

  async create(data: {
    engram_item_id: number;
    experience_type: string;
    content: string;
    date?: string | null;
  }): Promise<EngramItemExperience> {
    const _uuid = generateUUIDv7();
    await this.client.execute(
      'INSERT INTO engram_item_experiences (engram_item_id, experience_type, content, date) VALUES (?, ?, ?, ?)',
      [
        data.engram_item_id,
        data.experience_type,
        data.content,
        data.date ?? null,
      ],
    );
    const rows = await this.client.query(
      'SELECT * FROM engram_item_experiences WHERE id = last_insert_rowid()',
      [],
    );
    return rowToExperience(rows[0]);
  }

  async findById(id: number): Promise<EngramItemExperience | null> {
    const rows = await this.client.query(
      'SELECT * FROM engram_item_experiences WHERE id = ?',
      [id],
    );
    return rows.length > 0 ? rowToExperience(rows[0]) : null;
  }

  async update(
    id: number,
    data: Partial<{
      experience_type: string;
      content: string;
      date: string | null;
    }>,
  ): Promise<EngramItemExperience | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (data.experience_type !== undefined) {
      setClauses.push('experience_type = ?');
      params.push(data.experience_type);
    }
    if (data.content !== undefined) {
      setClauses.push('content = ?');
      params.push(data.content);
    }
    if (data.date !== undefined) {
      setClauses.push('date = ?');
      params.push(data.date);
    }

    if (setClauses.length === 0) return this.findById(id);

    params.push(id);
    await this.client.execute(
      `UPDATE engram_item_experiences SET ${setClauses.join(', ')} WHERE id = ?`,
      params,
    );
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await this.client.execute(
      'DELETE FROM engram_item_experiences WHERE id = ?',
      [id],
    );
  }

  async listByEngramItem(engramItemId: number): Promise<EngramItemExperience[]> {
    const rows = await this.client.query(
      'SELECT * FROM engram_item_experiences WHERE engram_item_id = ? ORDER BY created_at DESC',
      [engramItemId],
    );
    return rows.map(rowToExperience);
  }
}

export const experienceLinksRepository = new ExperienceLinksRepository(defaultDb);
