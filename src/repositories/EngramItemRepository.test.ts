import { vi, describe, it, expect, beforeEach } from 'vitest';
import { resetMockDb } from '../test/mockDb';

vi.mock('../lib/db', async () => {
  const { createMockDbClient } = await import('../test/mockDb');
  const client = await createMockDbClient();
  return { db: client };
});

const { runMigrations } = await import('../lib/migrations');
const { db } = await import('../lib/db');
const { EngramItemRepository } = await import('./EngramItemRepository');

type RepoType = InstanceType<typeof EngramItemRepository>;

let repo: RepoType;
let personId: number;

async function seedPerson(): Promise<number> {
  await (db as { execute: (sql: string, p: unknown[]) => Promise<unknown> }).execute(
    'INSERT INTO persons (name) VALUES (?)',
    ['Test Person'],
  );
  const rows = await (db as { query: (sql: string, p: unknown[]) => Promise<{ id: number }[]> }).query(
    'SELECT id FROM persons ORDER BY id DESC LIMIT 1',
    [],
  );
  return rows[0].id;
}

beforeEach(async () => {
  resetMockDb();
  await runMigrations();
  repo = new EngramItemRepository(db as Parameters<typeof EngramItemRepository>[0]);
  personId = await seedPerson();
});

describe('EngramItemRepository.create', () => {
  it('creates an item and returns a typed object', async () => {
    const item = await repo.create({
      person_id: personId,
      cloud_type: 'memory',
      title: 'First memory',
      content: 'A vivid childhood moment',
    });

    expect(item.id).toBeTypeOf('number');
    expect(item.person_id).toBe(personId);
    expect(item.cloud_type).toBe('memory');
    expect(item.title).toBe('First memory');
    expect(item.content).toBe('A vivid childhood moment');
    expect(item.deleted_at).toBeNull();
    expect(item.created_at).toBeTypeOf('string');
  });

  it('stores optional date and life_phase_id', async () => {
    const item = await repo.create({
      person_id: personId,
      cloud_type: 'knowledge',
      title: 'Python basics',
      content: 'Loops and functions',
      date: '2020-05-01',
      life_phase_id: null,
    });

    expect(item.date).toBe('2020-05-01');
    expect(item.life_phase_id).toBeNull();
  });

  it('defaults date and life_phase_id to null when omitted', async () => {
    const item = await repo.create({
      person_id: personId,
      cloud_type: 'belief',
      title: 'Hard work pays off',
      content: 'Consistent effort leads to results',
    });

    expect(item.date).toBeNull();
    expect(item.life_phase_id).toBeNull();
  });
});

describe('EngramItemRepository.findById', () => {
  it('returns item by id', async () => {
    const created = await repo.create({
      person_id: personId,
      cloud_type: 'value',
      title: 'Integrity',
      content: 'Being honest in all actions',
    });

    const found = await repo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.title).toBe('Integrity');
  });

  it('returns null for non-existent id', async () => {
    const found = await repo.findById(99999);
    expect(found).toBeNull();
  });

  it('returns null for soft-deleted items', async () => {
    const item = await repo.create({
      person_id: personId,
      cloud_type: 'goal',
      title: 'Run a marathon',
      content: 'Complete a 42km race',
    });
    await repo.softDelete(item.id);
    const found = await repo.findById(item.id);
    expect(found).toBeNull();
  });
});

describe('EngramItemRepository.update', () => {
  it('updates title and content', async () => {
    const item = await repo.create({
      person_id: personId,
      cloud_type: 'skill',
      title: 'Old title',
      content: 'Old content',
    });

    const updated = await repo.update(item.id, {
      title: 'New title',
      content: 'New content',
    });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('New title');
    expect(updated!.content).toBe('New content');
  });

  it('updates cloud_type', async () => {
    const item = await repo.create({
      person_id: personId,
      cloud_type: 'memory',
      title: 'Something',
      content: 'Content',
    });

    const updated = await repo.update(item.id, { cloud_type: 'reflection' });
    expect(updated!.cloud_type).toBe('reflection');
  });

  it('updates date to null', async () => {
    const item = await repo.create({
      person_id: personId,
      cloud_type: 'memory',
      title: 'Dated memory',
      content: 'Content',
      date: '2021-01-01',
    });

    const updated = await repo.update(item.id, { date: null });
    expect(updated!.date).toBeNull();
  });

  it('returns null for soft-deleted item', async () => {
    const item = await repo.create({
      person_id: personId,
      cloud_type: 'memory',
      title: 'To delete',
      content: 'Content',
    });
    await repo.softDelete(item.id);
    const result = await repo.update(item.id, { title: 'Ghost update' });
    expect(result).toBeNull();
  });
});

describe('EngramItemRepository.softDelete', () => {
  it('marks item as deleted without removing from database', async () => {
    const item = await repo.create({
      person_id: personId,
      cloud_type: 'memory',
      title: 'To be deleted',
      content: 'Content',
    });

    await repo.softDelete(item.id);

    // findById should return null (respects tombstone filter)
    const found = await repo.findById(item.id);
    expect(found).toBeNull();

    // Raw query should still show the record with deleted_at set
    const rows = await (db as { query: (sql: string, p: unknown[]) => Promise<{ deleted_at: string | null }[]> }).query(
      'SELECT deleted_at FROM engram_items WHERE id = ?',
      [item.id],
    );
    expect(rows[0].deleted_at).not.toBeNull();
  });

  it('is idempotent — double delete does not error', async () => {
    const item = await repo.create({
      person_id: personId,
      cloud_type: 'memory',
      title: 'Double delete',
      content: 'Content',
    });
    await repo.softDelete(item.id);
    await expect(repo.softDelete(item.id)).resolves.toBeUndefined();
  });
});

describe('EngramItemRepository.list', () => {
  beforeEach(async () => {
    await repo.create({ person_id: personId, cloud_type: 'memory', title: 'Memory 1', content: 'A' });
    await repo.create({ person_id: personId, cloud_type: 'memory', title: 'Memory 2', content: 'B' });
    await repo.create({ person_id: personId, cloud_type: 'knowledge', title: 'Knowledge 1', content: 'C' });
    await repo.create({ person_id: personId, cloud_type: 'belief', title: 'Belief 1', content: 'D', date: '2022-01-15' });
  });

  it('lists all active items (tombstone = 0)', async () => {
    const items = await repo.list();
    expect(items.length).toBe(4);
    items.forEach(item => expect(item.deleted_at).toBeNull());
  });

  it('excludes soft-deleted items', async () => {
    const all = await repo.list();
    await repo.softDelete(all[0].id);
    const after = await repo.list();
    expect(after.length).toBe(3);
  });

  it('filters by person_id', async () => {
    // Insert another person's item
    await (db as { execute: (sql: string, p: unknown[]) => Promise<unknown> }).execute(
      'INSERT INTO persons (name) VALUES (?)',
      ['Other Person'],
    );
    const otherPersonRows = await (db as { query: (sql: string, p: unknown[]) => Promise<{ id: number }[]> }).query(
      'SELECT id FROM persons WHERE name = ? LIMIT 1',
      ['Other Person'],
    );
    const otherId = otherPersonRows[0].id;
    await repo.create({ person_id: otherId, cloud_type: 'memory', title: 'Not mine', content: 'X' });

    const items = await repo.list({ person_id: personId });
    expect(items.length).toBe(4);
    items.forEach(item => expect(item.person_id).toBe(personId));
  });

  it('filters by cloud_type', async () => {
    const memories = await repo.list({ cloud_type: 'memory' });
    expect(memories.length).toBe(2);
    memories.forEach(item => expect(item.cloud_type).toBe('memory'));
  });

  it('filters by date range', async () => {
    const results = await repo.list({ date_from: '2022-01-01', date_to: '2022-12-31' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Belief 1');
  });

  it('filters by person_id and cloud_type combined', async () => {
    const results = await repo.list({ person_id: personId, cloud_type: 'knowledge' });
    expect(results.length).toBe(1);
    expect(results[0].cloud_type).toBe('knowledge');
  });
});

describe('EngramItemRepository.search', () => {
  beforeEach(async () => {
    await repo.create({ person_id: personId, cloud_type: 'memory', title: 'Seashore morning', content: 'Standing on the beach at dawn' });
    await repo.create({ person_id: personId, cloud_type: 'knowledge', title: 'Tidal forces', content: 'Gravity pulls the water' });
    await repo.create({ person_id: personId, cloud_type: 'belief', title: 'Mountain calm', content: 'Peace in silence' });
  });

  it('finds items matching title query', async () => {
    const results = await repo.search('Seashore');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Seashore morning');
  });

  it('finds items matching content query', async () => {
    const results = await repo.search('beach');
    expect(results.length).toBe(1);
    expect(results[0].content).toContain('beach');
  });

  it('matches across title and content', async () => {
    const results = await repo.search('calm');
    // "Mountain calm" title and "Peace in silence" — only 1 matches "calm"
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Mountain calm');
  });

  it('returns empty array for no matches', async () => {
    const results = await repo.search('xyznotfound');
    expect(results.length).toBe(0);
  });

  it('scopes search to personId when provided', async () => {
    await (db as { execute: (sql: string, p: unknown[]) => Promise<unknown> }).execute(
      'INSERT INTO persons (name) VALUES (?)',
      ['Other'],
    );
    const otherRows = await (db as { query: (sql: string, p: unknown[]) => Promise<{ id: number }[]> }).query(
      'SELECT id FROM persons WHERE name = ? LIMIT 1',
      ['Other'],
    );
    const otherId = otherRows[0].id;
    await repo.create({ person_id: otherId, cloud_type: 'memory', title: 'Seashore trip', content: 'A trip to the shore' });

    const results = await repo.search('Seashore', personId);
    expect(results.length).toBe(1);
    results.forEach(r => expect(r.person_id).toBe(personId));
  });

  it('excludes soft-deleted items from search', async () => {
    const all = await repo.search('beach');
    await repo.softDelete(all[0].id);
    const after = await repo.search('beach');
    expect(after.length).toBe(0);
  });
});
