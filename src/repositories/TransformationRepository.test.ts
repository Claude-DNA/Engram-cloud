import { vi, describe, it, expect, beforeEach } from 'vitest';
import { resetMockDb } from '../test/mockDb';

vi.mock('../lib/db', async () => {
  const { createMockDbClient } = await import('../test/mockDb');
  const client = await createMockDbClient();
  return { db: client };
});

const { runMigrations } = await import('../lib/migrations');
const { db } = await import('../lib/db');
const { TransformationRepository } = await import('./TransformationRepository');

type RepoType = InstanceType<typeof TransformationRepository>;

let repo: RepoType;
let personId: number;
let sourceId: number;
let targetId: number;

type RawDb = {
  execute(sql: string, params: unknown[]): Promise<unknown>;
  query<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<T[]>;
};

async function seedFixtures(rawDb: RawDb): Promise<void> {
  await rawDb.execute('INSERT INTO persons (name) VALUES (?)', ['Alice']);
  const persons = await rawDb.query<{ id: number }>('SELECT id FROM persons ORDER BY id DESC LIMIT 1', []);
  personId = persons[0].id;

  await rawDb.execute(
    'INSERT INTO engram_items (person_id, cloud_type, title, content) VALUES (?, ?, ?, ?)',
    [personId, 'memory', 'Source Memory', 'Content A'],
  );
  const sources = await rawDb.query<{ id: number }>(
    'SELECT id FROM engram_items ORDER BY id ASC LIMIT 1',
    [],
  );
  sourceId = sources[0].id;

  await rawDb.execute(
    'INSERT INTO engram_items (person_id, cloud_type, title, content) VALUES (?, ?, ?, ?)',
    [personId, 'belief', 'Target Belief', 'Content B'],
  );
  const targets = await rawDb.query<{ id: number }>(
    'SELECT id FROM engram_items ORDER BY id DESC LIMIT 1',
    [],
  );
  targetId = targets[0].id;
}

beforeEach(async () => {
  resetMockDb();
  await runMigrations();
  repo = new TransformationRepository(db as Parameters<typeof TransformationRepository>[0]);
  await seedFixtures(db as RawDb);
});

describe('TransformationRepository.create', () => {
  it('creates a transformation and returns a typed object', async () => {
    const t = await repo.create({
      person_id: personId,
      source_id: sourceId,
      target_id: targetId,
      transformation_type: 'insight',
      description: 'Memory sparked a belief',
    });

    expect(t.id).toBeTypeOf('number');
    expect(t.person_id).toBe(personId);
    expect(t.source_id).toBe(sourceId);
    expect(t.target_id).toBe(targetId);
    expect(t.transformation_type).toBe('insight');
    expect(t.description).toBe('Memory sparked a belief');
    expect(t.created_at).toBeTypeOf('string');
  });

  it('allows null description', async () => {
    const t = await repo.create({
      person_id: personId,
      source_id: sourceId,
      target_id: targetId,
      transformation_type: 'evolution',
    });
    expect(t.description).toBeNull();
  });
});

describe('TransformationRepository.findById', () => {
  it('returns transformation by id', async () => {
    const created = await repo.create({
      person_id: personId,
      source_id: sourceId,
      target_id: targetId,
      transformation_type: 'insight',
    });

    const found = await repo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.transformation_type).toBe('insight');
  });

  it('returns null for non-existent id', async () => {
    const found = await repo.findById(99999);
    expect(found).toBeNull();
  });
});

describe('TransformationRepository.update', () => {
  it('updates transformation_type', async () => {
    const t = await repo.create({
      person_id: personId,
      source_id: sourceId,
      target_id: targetId,
      transformation_type: 'insight',
    });

    const updated = await repo.update(t.id, { transformation_type: 'evolution' });
    expect(updated).not.toBeNull();
    expect(updated!.transformation_type).toBe('evolution');
  });

  it('updates description', async () => {
    const t = await repo.create({
      person_id: personId,
      source_id: sourceId,
      target_id: targetId,
      transformation_type: 'insight',
      description: 'Old desc',
    });

    const updated = await repo.update(t.id, { description: 'New desc' });
    expect(updated!.description).toBe('New desc');
  });

  it('updates description to null', async () => {
    const t = await repo.create({
      person_id: personId,
      source_id: sourceId,
      target_id: targetId,
      transformation_type: 'insight',
      description: 'Will be cleared',
    });

    const updated = await repo.update(t.id, { description: null });
    expect(updated!.description).toBeNull();
  });

  it('returns same record when no fields provided', async () => {
    const t = await repo.create({
      person_id: personId,
      source_id: sourceId,
      target_id: targetId,
      transformation_type: 'insight',
    });

    const result = await repo.update(t.id, {});
    expect(result!.id).toBe(t.id);
    expect(result!.transformation_type).toBe('insight');
  });
});

describe('TransformationRepository.delete', () => {
  it('removes the transformation from the database', async () => {
    const t = await repo.create({
      person_id: personId,
      source_id: sourceId,
      target_id: targetId,
      transformation_type: 'insight',
    });

    await repo.delete(t.id);

    const found = await repo.findById(t.id);
    expect(found).toBeNull();
  });
});

describe('TransformationRepository.listByPerson', () => {
  it('returns all transformations for a person', async () => {
    await repo.create({ person_id: personId, source_id: sourceId, target_id: targetId, transformation_type: 'insight' });
    await repo.create({ person_id: personId, source_id: sourceId, target_id: targetId, transformation_type: 'evolution' });

    const results = await repo.listByPerson(personId);
    expect(results.length).toBe(2);
    results.forEach(r => expect(r.person_id).toBe(personId));
  });

  it('returns empty array for person with no transformations', async () => {
    const results = await repo.listByPerson(99999);
    expect(results).toEqual([]);
  });
});

describe('TransformationRepository.listBySource', () => {
  it('returns transformations where source_id matches', async () => {
    await repo.create({ person_id: personId, source_id: sourceId, target_id: targetId, transformation_type: 'insight' });
    await repo.create({ person_id: personId, source_id: sourceId, target_id: targetId, transformation_type: 'evolution' });

    const results = await repo.listBySource(sourceId);
    expect(results.length).toBe(2);
    results.forEach(r => expect(r.source_id).toBe(sourceId));
  });

  it('returns empty for unknown source', async () => {
    const results = await repo.listBySource(99999);
    expect(results).toEqual([]);
  });
});

describe('TransformationRepository.listByTarget', () => {
  it('returns transformations where target_id matches', async () => {
    await repo.create({ person_id: personId, source_id: sourceId, target_id: targetId, transformation_type: 'insight' });

    const results = await repo.listByTarget(targetId);
    expect(results.length).toBe(1);
    expect(results[0].target_id).toBe(targetId);
  });

  it('returns empty for unknown target', async () => {
    const results = await repo.listByTarget(99999);
    expect(results).toEqual([]);
  });
});
