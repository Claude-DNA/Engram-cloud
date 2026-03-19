import type { DbClient, Row } from '../lib/db';
import { db as defaultDb } from '../lib/db';
import { generateUUIDv7 } from '../lib/uuid';
import type { Person } from '../types/engram';

function rowToPerson(row: Row): Person {
  return {
    id: row.id as number,
    uuid: row.uuid as string,
    name: row.name as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string | null) ?? null,
  };
}

export class PersonRepository {
  constructor(private readonly client: DbClient) {}

  async create(data: { name: string }): Promise<Person> {
    const uuid = generateUUIDv7();
    await this.client.execute(
      'INSERT INTO persons (uuid, name) VALUES (?, ?)',
      [uuid, data.name],
    );
    const rows = await this.client.query(
      'SELECT * FROM persons WHERE id = last_insert_rowid()',
      [],
    );
    return rowToPerson(rows[0]);
  }

  async findById(id: number): Promise<Person | null> {
    const rows = await this.client.query(
      'SELECT * FROM persons WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return rows.length > 0 ? rowToPerson(rows[0]) : null;
  }

  async findByUuid(uuid: string): Promise<Person | null> {
    const rows = await this.client.query(
      'SELECT * FROM persons WHERE uuid = ? AND deleted_at IS NULL',
      [uuid],
    );
    return rows.length > 0 ? rowToPerson(rows[0]) : null;
  }

  async update(id: number, data: Partial<{ name: string }>): Promise<Person | null> {
    if (data.name !== undefined) {
      await this.client.execute(
        'UPDATE persons SET name = ? WHERE id = ? AND deleted_at IS NULL',
        [data.name, id],
      );
    }
    return this.findById(id);
  }

  async softDelete(id: number): Promise<void> {
    await this.client.execute(
      "UPDATE persons SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
      [id],
    );
  }

  async list(): Promise<Person[]> {
    const rows = await this.client.query(
      'SELECT * FROM persons WHERE deleted_at IS NULL ORDER BY created_at DESC',
      [],
    );
    return rows.map(rowToPerson);
  }
}

export const personRepository = new PersonRepository(defaultDb);
