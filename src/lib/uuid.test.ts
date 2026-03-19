import { describe, it, expect, beforeEach } from 'vitest';
import { generateUUIDv7, _resetUUIDState } from './uuid';

describe('generateUUIDv7', () => {
  beforeEach(() => {
    _resetUUIDState();
  });

  it('returns a valid UUID v7 format', () => {
    const uuid = generateUUIDv7();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('generates unique UUIDs', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      uuids.add(generateUUIDv7());
    }
    expect(uuids.size).toBe(1000);
  });

  it('generates 100 UUIDs in strict ascending sort order (monotonic)', () => {
    const uuids: string[] = [];
    for (let i = 0; i < 100; i++) {
      uuids.push(generateUUIDv7());
    }
    const sorted = [...uuids].sort();
    expect(uuids).toEqual(sorted);
  });

  it('has version 7 in the correct position', () => {
    for (let i = 0; i < 50; i++) {
      const uuid = generateUUIDv7();
      expect(uuid[14]).toBe('7');
    }
  });

  it('has correct variant bits (10xx)', () => {
    for (let i = 0; i < 50; i++) {
      const uuid = generateUUIDv7();
      const variantChar = uuid[19];
      expect(['8', '9', 'a', 'b']).toContain(variantChar);
    }
  });

  it('embeds timestamp that increases over time', async () => {
    const uuid1 = generateUUIDv7();
    await new Promise((r) => setTimeout(r, 5));
    const uuid2 = generateUUIDv7();

    // Extract timestamp (first 12 hex chars, ignoring dashes)
    const ts1 = parseInt(uuid1.replace(/-/g, '').slice(0, 12), 16);
    const ts2 = parseInt(uuid2.replace(/-/g, '').slice(0, 12), 16);
    expect(ts2).toBeGreaterThan(ts1);
  });
});
