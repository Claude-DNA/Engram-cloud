import type { DbClient, Row } from '../lib/db';
import { db as defaultDb } from '../lib/db';
import { generateUUIDv7 } from '../lib/uuid';
import type { Transformation } from '../types/engram';

function rowToTransformation(row: Row): Transformation {
  return {
    id: row.id as number,
    uuid: row.uuid as string,
    person_id: row.person_id as number,
    source_id: row.source_id as number,
    target_id: row.target_id as number,
    transformation_type: row.transformation_type as string,
    description: (row.description as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export class TransformationRepository {
  constructor(private readonly client: DbClient) {}

  async create(data: {
    person_id: number;
    source_id: number;
    target_id: number;
    transformation_type: string;
    description?: string | null;
  }): Promise<Transformation> {
    const uuid = generateUUIDv7();
    await this.client.execute(
      'INSERT INTO transformations (uuid, person_id, source_id, target_id, transformation_type, description) VALUES (?, ?, ?, ?, ?, ?)',
      [
        uuid,
        data.person_id,
        data.source_id,
        data.target_id,
        data.transformation_type,
        data.description ?? null,
      ],
    );
    const rows = await this.client.query(
      'SELECT * FROM transformations WHERE id = last_insert_rowid()',
      [],
    );
    return rowToTransformation(rows[0]);
  }

  async findById(id: number): Promise<Transformation | null> {
    const rows = await this.client.query(
      'SELECT * FROM transformations WHERE id = ?',
      [id],
    );
    return rows.length > 0 ? rowToTransformation(rows[0]) : null;
  }

  async findByUuid(uuid: string): Promise<Transformation | null> {
    const rows = await this.client.query(
      'SELECT * FROM transformations WHERE uuid = ?',
      [uuid],
    );
    return rows.length > 0 ? rowToTransformation(rows[0]) : null;
  }

  async update(
    id: number,
    data: Partial<{
      transformation_type: string;
      description: string | null;
    }>,
  ): Promise<Transformation | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (data.transformation_type !== undefined) {
      setClauses.push('transformation_type = ?');
      params.push(data.transformation_type);
    }
    if (data.description !== undefined) {
      setClauses.push('description = ?');
      params.push(data.description);
    }

    if (setClauses.length === 0) return this.findById(id);

    params.push(id);
    await this.client.execute(
      `UPDATE transformations SET ${setClauses.join(', ')} WHERE id = ?`,
      params,
    );
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await this.client.execute('DELETE FROM transformations WHERE id = ?', [id]);
  }

  async listByPerson(personId: number): Promise<Transformation[]> {
    const rows = await this.client.query(
      'SELECT * FROM transformations WHERE person_id = ? ORDER BY created_at DESC',
      [personId],
    );
    return rows.map(rowToTransformation);
  }

  async listBySource(sourceId: number): Promise<Transformation[]> {
    const rows = await this.client.query(
      'SELECT * FROM transformations WHERE source_id = ? ORDER BY created_at DESC',
      [sourceId],
    );
    return rows.map(rowToTransformation);
  }

  async listByTarget(targetId: number): Promise<Transformation[]> {
    const rows = await this.client.query(
      'SELECT * FROM transformations WHERE target_id = ? ORDER BY created_at DESC',
      [targetId],
    );
    return rows.map(rowToTransformation);
  }
}

export const transformationRepository = new TransformationRepository(defaultDb);
