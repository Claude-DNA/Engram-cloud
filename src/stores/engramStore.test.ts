import { describe, it, expect, beforeEach } from 'vitest';
import { useEngramStore } from './engramStore';
import type { StoreLoader } from './engramStore';
import type { EngramItem, Person, LifePhase } from '../types/engram';

// --- Test fixtures ---

const mockPerson: Person = {
  id: 1,
  name: 'Test Person',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
};

const mockPerson2: Person = {
  id: 2,
  name: 'Another Person',
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  deleted_at: null,
};

const mockItem: EngramItem = {
  id: 1,
  person_id: 1,
  cloud_type: 'memory',
  title: 'First memory',
  content: 'Something happened',
  date: '2026-01-15',
  life_phase_id: null,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  deleted_at: null,
};

const mockItem2: EngramItem = {
  id: 2,
  person_id: 1,
  cloud_type: 'belief',
  title: 'A core belief',
  content: 'I believe in testing',
  date: '2026-02-01',
  life_phase_id: null,
  created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z',
  deleted_at: null,
};

const mockPhase: LifePhase = {
  id: 1,
  person_id: 1,
  name: 'Childhood',
  start_date: '1990-01-01',
  end_date: '2008-06-01',
  description: 'Growing up',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function createMockLoader(overrides?: Partial<StoreLoader>): StoreLoader {
  return {
    loadPersons: async () => [mockPerson],
    loadEngramItems: async () => [mockItem, mockItem2],
    loadLifePhases: async () => [mockPhase],
    ...overrides,
  };
}

// --- Tests ---

describe('engramStore', () => {
  beforeEach(() => {
    useEngramStore.getState().reset();
  });

  describe('initial state', () => {
    it('starts unhydrated with empty collections', () => {
      const state = useEngramStore.getState();
      expect(state.isHydrated).toBe(false);
      expect(state.persons).toEqual([]);
      expect(state.engramItems).toEqual([]);
      expect(state.lifePhases).toEqual([]);
      expect(state.activePersonId).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('hydrate', () => {
    it('loads persons, items, and life phases', async () => {
      const loader = createMockLoader();
      await useEngramStore.getState().hydrate(loader);

      const state = useEngramStore.getState();
      expect(state.isHydrated).toBe(true);
      expect(state.persons).toEqual([mockPerson]);
      expect(state.engramItems).toEqual([mockItem, mockItem2]);
      expect(state.lifePhases).toEqual([mockPhase]);
      expect(state.activePersonId).toBe(1);
      expect(state.isLoading).toBe(false);
    });

    it('sets hasMore=false when items < pageSize', async () => {
      const loader = createMockLoader();
      await useEngramStore.getState().hydrate(loader);

      const state = useEngramStore.getState();
      expect(state.hasMore).toBe(false); // 2 items < 50 pageSize
    });

    it('sets hasMore=true when items === pageSize', async () => {
      const manyItems = Array.from({ length: 50 }, (_, i) => ({
        ...mockItem,
        id: i + 1,
        title: `Item ${i + 1}`,
      }));
      const loader = createMockLoader({
        loadEngramItems: async () => manyItems,
      });
      await useEngramStore.getState().hydrate(loader);

      expect(useEngramStore.getState().hasMore).toBe(true);
    });

    it('handles empty database gracefully', async () => {
      const loader = createMockLoader({
        loadPersons: async () => [],
        loadEngramItems: async () => [],
        loadLifePhases: async () => [],
      });
      await useEngramStore.getState().hydrate(loader);

      const state = useEngramStore.getState();
      expect(state.isHydrated).toBe(true);
      expect(state.activePersonId).toBeNull();
      expect(state.persons).toEqual([]);
      expect(state.engramItems).toEqual([]);
    });

    it('captures error and stops loading on failure', async () => {
      const loader = createMockLoader({
        loadPersons: async () => {
          throw new Error('DB corrupted');
        },
      });
      await useEngramStore.getState().hydrate(loader);

      const state = useEngramStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.isHydrated).toBe(false);
      expect(state.error).toBe('DB corrupted');
    });
  });

  describe('loadMore', () => {
    it('appends items to existing collection', async () => {
      // Hydrate with exactly pageSize items so hasMore=true
      const pageItems = Array.from({ length: 50 }, (_, i) => ({
        ...mockItem,
        id: i + 1,
        title: `Item ${i + 1}`,
      }));
      const loader = createMockLoader({
        loadEngramItems: async () => pageItems,
      });
      await useEngramStore.getState().hydrate(loader);
      expect(useEngramStore.getState().hasMore).toBe(true);

      const moreItem: EngramItem = {
        ...mockItem,
        id: 99,
        title: 'Loaded later',
      };
      const moreLoader = createMockLoader({
        loadEngramItems: async () => [moreItem],
      });
      await useEngramStore.getState().loadMore(moreLoader);

      const state = useEngramStore.getState();
      expect(state.engramItems).toHaveLength(51);
      expect(state.engramItems[50].id).toBe(99);
    });

    it('does nothing when hasMore is false and no items returned', async () => {
      const loader = createMockLoader({
        loadEngramItems: async () => [], // triggers hasMore=false
      });
      // First hydrate with hasMore already false
      await useEngramStore.getState().hydrate(loader);
      expect(useEngramStore.getState().hasMore).toBe(false);

      // loadMore should bail early
      await useEngramStore.getState().loadMore(loader);
      expect(useEngramStore.getState().engramItems).toEqual([]);
    });
  });

  describe('surgical updates — items', () => {
    beforeEach(async () => {
      const loader = createMockLoader();
      await useEngramStore.getState().hydrate(loader);
    });

    it('itemCreated prepends to list', () => {
      const newItem: EngramItem = {
        ...mockItem,
        id: 10,
        title: 'Brand new',
      };
      useEngramStore.getState().itemCreated(newItem);

      const items = useEngramStore.getState().engramItems;
      expect(items[0].id).toBe(10);
      expect(items).toHaveLength(3);
    });

    it('itemUpdated replaces the matching item', () => {
      const updated: EngramItem = {
        ...mockItem,
        title: 'Updated title',
      };
      useEngramStore.getState().itemUpdated(updated);

      const items = useEngramStore.getState().engramItems;
      expect(items.find((i) => i.id === 1)?.title).toBe('Updated title');
      expect(items).toHaveLength(2);
    });

    it('itemDeleted removes the item', () => {
      useEngramStore.getState().itemDeleted(1);

      const items = useEngramStore.getState().engramItems;
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(2);
    });
  });

  describe('surgical updates — persons', () => {
    beforeEach(async () => {
      const loader = createMockLoader();
      await useEngramStore.getState().hydrate(loader);
    });

    it('personCreated adds person and sets active if none', () => {
      // Reset active person to null first
      useEngramStore.getState().reset();
      useEngramStore.getState().personCreated(mockPerson);

      const state = useEngramStore.getState();
      expect(state.persons).toHaveLength(1);
      expect(state.activePersonId).toBe(1);
    });

    it('personCreated does not override existing active person', () => {
      useEngramStore.getState().personCreated(mockPerson2);

      const state = useEngramStore.getState();
      expect(state.persons).toHaveLength(2);
      expect(state.activePersonId).toBe(1); // unchanged
    });

    it('personDeleted clears items if active person deleted', () => {
      useEngramStore.getState().personDeleted(1);

      const state = useEngramStore.getState();
      expect(state.persons).toEqual([]);
      expect(state.activePersonId).toBeNull();
      expect(state.engramItems).toEqual([]);
    });

    it('personDeleted switches to next person if available', () => {
      useEngramStore.getState().personCreated(mockPerson2);
      useEngramStore.getState().personDeleted(1);

      const state = useEngramStore.getState();
      expect(state.activePersonId).toBe(2);
    });
  });

  describe('surgical updates — life phases', () => {
    beforeEach(async () => {
      const loader = createMockLoader();
      await useEngramStore.getState().hydrate(loader);
    });

    it('lifePhaseCreated adds and sorts by start_date', () => {
      const newPhase: LifePhase = {
        ...mockPhase,
        id: 2,
        name: 'College',
        start_date: '2008-09-01',
      };
      useEngramStore.getState().lifePhaseCreated(newPhase);

      const phases = useEngramStore.getState().lifePhases;
      expect(phases).toHaveLength(2);
      expect(phases[0].name).toBe('Childhood');
      expect(phases[1].name).toBe('College');
    });

    it('lifePhaseDeleted removes the phase', () => {
      useEngramStore.getState().lifePhaseDeleted(1);
      expect(useEngramStore.getState().lifePhases).toEqual([]);
    });
  });

  describe('getFilteredItems', () => {
    beforeEach(async () => {
      const loader = createMockLoader();
      await useEngramStore.getState().hydrate(loader);
    });

    it('returns all items when no filters set', () => {
      const items = useEngramStore.getState().getFilteredItems();
      expect(items).toHaveLength(2);
    });

    it('filters by cloud type', () => {
      useEngramStore.getState().setActiveCloudType('memory');
      const items = useEngramStore.getState().getFilteredItems();
      expect(items).toHaveLength(1);
      expect(items[0].cloud_type).toBe('memory');
    });

    it('filters by search query (title)', () => {
      useEngramStore.getState().setSearchQuery('core');
      const items = useEngramStore.getState().getFilteredItems();
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('A core belief');
    });

    it('filters by search query (content)', () => {
      useEngramStore.getState().setSearchQuery('testing');
      const items = useEngramStore.getState().getFilteredItems();
      expect(items).toHaveLength(1);
    });

    it('combines cloud type and search filters', () => {
      useEngramStore.getState().setActiveCloudType('belief');
      useEngramStore.getState().setSearchQuery('core');
      const items = useEngramStore.getState().getFilteredItems();
      expect(items).toHaveLength(1);
    });

    it('returns empty when filters match nothing', () => {
      useEngramStore.getState().setSearchQuery('xyz-nonexistent');
      const items = useEngramStore.getState().getFilteredItems();
      expect(items).toEqual([]);
    });
  });

  describe('UI actions', () => {
    it('setActiveCloudType updates state', () => {
      useEngramStore.getState().setActiveCloudType('skill');
      expect(useEngramStore.getState().activeCloudType).toBe('skill');
    });

    it('setActiveCloudType can be cleared to null', () => {
      useEngramStore.getState().setActiveCloudType('skill');
      useEngramStore.getState().setActiveCloudType(null);
      expect(useEngramStore.getState().activeCloudType).toBeNull();
    });

    it('setSearchQuery updates state', () => {
      useEngramStore.getState().setSearchQuery('test query');
      expect(useEngramStore.getState().searchQuery).toBe('test query');
    });

    it('setError updates and clears', () => {
      useEngramStore.getState().setError('Something broke');
      expect(useEngramStore.getState().error).toBe('Something broke');

      useEngramStore.getState().setError(null);
      expect(useEngramStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('restores all state to initial values', async () => {
      const loader = createMockLoader();
      await useEngramStore.getState().hydrate(loader);
      useEngramStore.getState().setActiveCloudType('belief');
      useEngramStore.getState().setSearchQuery('something');

      useEngramStore.getState().reset();

      const state = useEngramStore.getState();
      expect(state.isHydrated).toBe(false);
      expect(state.persons).toEqual([]);
      expect(state.engramItems).toEqual([]);
      expect(state.activeCloudType).toBeNull();
      expect(state.searchQuery).toBe('');
    });
  });
});
