import type { DbClient, Row } from '../lib/db';
import { db as defaultDb } from '../lib/db';
import { generateUUIDv7 } from '../lib/uuid';
import type { LifePhase } from '../types/engram';

function rowToLifePhase(row: Row): LifePhase {
  return {
    id: row.id as number,
    uuid: row.uuid as string,
    person_id: row.person_id as number,
    name: row.name as string,
    start_date: row.start_date as string,
    end_date: (row.end_date as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export class LifePhaseRepository {
  constructor(private readonly client: DbClient) {}

  async create(data: {
    person_id: number;
    name: string;
    start_date: string;
    end_date?: string | null;
    description?: string | null;
  }): Promise<LifePhase> {
    const uuid = generateUUIDv7();
    await this.client.execute(
      'INSERT INTO life_phases (uuid, person_id, name, start_date, end_date, description) VALUES (?, ?, ?, ?, ?, ?)',
      [
        uuid,
        data.person_id,
        data.name,
        data.start_date,
        data.end_date ?? null,
        data.description ?? null,
      ],
    );
    const rows = await this.client.query(
      'SELECT * FROM life_phases WHERE id = last_insert_rowid()',
      [],
    );
    return rowToLifePhase(rows[0]);
  }

  async findById(id: number): Promise<LifePhase | null> {
    const rows = await this.client.query(
      'SELECT * FROM life_phases WHERE id = ?',
      [id],
    );
    return rows.length > 0 ? rowToLifePhase(rows[0]) : null;
  }

  async findByUuid(uuid: string): Promise<LifePhase | null> {
    const rows = await this.client.query(
      'SELECT * FROM life_phases WHERE uuid = ?',
      [uuid],
    );
    return rows.length > 0 ? rowToLifePhase(rows[0]) : null;
  }

  async update(
    id: number,
    data: Partial<{
      name: string;
      start_date: string;
      end_date: string | null;
      description: string | null;
    }>,
  ): Promise<LifePhase | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      setClauses.push('name = ?');
      params.push(data.name);
    }
    if (data.start_date !== undefined) {
      setClauses.push('start_date = ?');
      params.push(data.start_date);
    }
    if (data.end_date !== undefined) {
      setClauses.push('end_date = ?');
      params.push(data.end_date);
    }
    if (data.description !== undefined) {
      setClauses.push('description = ?');
      params.push(data.description);
    }

    if (setClauses.length === 0) return this.findById(id);

    params.push(id);
    await this.client.execute(
      `UPDATE life_phases SET ${setClauses.join(', ')} WHERE id = ?`,
      params,
    );
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await this.client.execute('DELETE FROM life_phases WHERE id = ?', [id]);
  }

  async listByPerson(personId: number): Promise<LifePhase[]> {
    const rows = await this.client.query(
      'SELECT * FROM life_phases WHERE person_id = ? ORDER BY start_date ASC',
      [personId],
    );
    return rows.map(rowToLifePhase);
  }
}

export const lifePhaseRepository = new LifePhaseRepository(defaultDb);
