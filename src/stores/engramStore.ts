import { create } from 'zustand';
import type { CloudType, EngramItem, Person, LifePhase } from '../types/engram';
import type { EngramItemFilters } from '../repositories';

/**
 * Engram Store — State Reconstruction Engine
 *
 * Design principles (from Cowork architecture review):
 * 1. SQLite is the single source of truth — store is a derived cache
 * 2. Write to DB first, then hydrate store (never the reverse)
 * 3. Paginated startup hydration (don't block UI on full DB load)
 * 4. Surgical store updates after DB writes (don't re-query entire DB)
 * 5. Offline-first: every action succeeds locally, no blocking pending states
 */

// --- Types ---

export interface EngramStoreState {
  // Data cache
  persons: Person[];
  activePersonId: number | null;
  engramItems: EngramItem[];
  lifePhases: LifePhase[];

  // UI state
  activeCloudType: CloudType | null;
  searchQuery: string;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  // Pagination
  pageSize: number;
  hasMore: boolean;
  currentOffset: number;
}

export interface EngramStoreActions {
  // Hydration
  hydrate: (loader: StoreLoader) => Promise<void>;
  loadMore: (loader: StoreLoader) => Promise<void>;

  // Surgical updates (call AFTER successful DB write)
  itemCreated: (item: EngramItem) => void;
  itemUpdated: (item: EngramItem) => void;
  itemDeleted: (id: number) => void;

  personCreated: (person: Person) => void;
  personUpdated: (person: Person) => void;
  personDeleted: (id: number) => void;

  lifePhaseCreated: (phase: LifePhase) => void;
  lifePhaseUpdated: (phase: LifePhase) => void;
  lifePhaseDeleted: (id: number) => void;

  // UI actions
  setActivePersonId: (id: number | null) => void;
  setActiveCloudType: (type: CloudType | null) => void;
  setSearchQuery: (query: string) => void;
  setError: (error: string | null) => void;

  // Filtered view (computed from cache)
  getFilteredItems: () => EngramItem[];

  // Reset
  reset: () => void;
}

export type EngramStore = EngramStoreState & EngramStoreActions;

/**
 * StoreLoader — interface for data loading, injectable for testing.
 * In production, wraps repository calls. In tests, mock it.
 */
export interface StoreLoader {
  loadPersons: () => Promise<Person[]>;
  loadEngramItems: (filters: EngramItemFilters & { limit: number; offset: number }) => Promise<EngramItem[]>;
  loadLifePhases: (personId: number) => Promise<LifePhase[]>;
}

// --- Initial State ---

const DEFAULT_PAGE_SIZE = 50;

const initialState: EngramStoreState = {
  persons: [],
  activePersonId: null,
  engramItems: [],
  lifePhases: [],
  activeCloudType: null,
  searchQuery: '',
  isLoading: false,
  isHydrated: false,
  error: null,
  pageSize: DEFAULT_PAGE_SIZE,
  hasMore: true,
  currentOffset: 0,
};

// --- Store ---

export const useEngramStore = create<EngramStore>((set, get) => ({
  ...initialState,

  // --- Hydration ---

  hydrate: async (loader) => {
    set({ isLoading: true, error: null });
    try {
      const persons = await loader.loadPersons();
      const firstPersonId = persons.length > 0 ? persons[0].id : null;

      const items = await loader.loadEngramItems({
        person_id: firstPersonId ?? undefined,
        limit: DEFAULT_PAGE_SIZE,
        offset: 0,
      });

      let lifePhases: LifePhase[] = [];
      if (firstPersonId !== null) {
        lifePhases = await loader.loadLifePhases(firstPersonId);
      }

      set({
        persons,
        activePersonId: firstPersonId,
        engramItems: items,
        lifePhases,
        isHydrated: true,
        isLoading: false,
        currentOffset: items.length,
        hasMore: items.length >= DEFAULT_PAGE_SIZE,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      });
    }
  },

  loadMore: async (loader) => {
    const state = get();
    if (state.isLoading || !state.hasMore) return;

    set({ isLoading: true });
    try {
      const moreItems = await loader.loadEngramItems({
        person_id: state.activePersonId ?? undefined,
        cloud_type: state.activeCloudType ?? undefined,
        limit: state.pageSize,
        offset: state.currentOffset,
      });

      set({
        engramItems: [...state.engramItems, ...moreItems],
        currentOffset: state.currentOffset + moreItems.length,
        hasMore: moreItems.length >= state.pageSize,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      });
    }
  },

  // --- Surgical updates (DB already written) ---

  itemCreated: (item) =>
    set((state) => ({
      engramItems: [item, ...state.engramItems],
      currentOffset: state.currentOffset + 1,
    })),

  itemUpdated: (item) =>
    set((state) => ({
      engramItems: state.engramItems.map((i) => (i.id === item.id ? item : i)),
    })),

  itemDeleted: (id) =>
    set((state) => ({
      engramItems: state.engramItems.filter((i) => i.id !== id),
      currentOffset: Math.max(0, state.currentOffset - 1),
    })),

  personCreated: (person) =>
    set((state) => ({
      persons: [person, ...state.persons],
      activePersonId: state.activePersonId ?? person.id,
    })),

  personUpdated: (person) =>
    set((state) => ({
      persons: state.persons.map((p) => (p.id === person.id ? person : p)),
    })),

  personDeleted: (id) =>
    set((state) => {
      const remaining = state.persons.filter((p) => p.id !== id);
      const newActiveId =
        state.activePersonId === id
          ? remaining.length > 0
            ? remaining[0].id
            : null
          : state.activePersonId;
      return {
        persons: remaining,
        activePersonId: newActiveId,
        // Clear items if active person was deleted
        ...(state.activePersonId === id
          ? { engramItems: [], currentOffset: 0, hasMore: true }
          : {}),
      };
    }),

  lifePhaseCreated: (phase) =>
    set((state) => ({
      lifePhases: [...state.lifePhases, phase].sort((a, b) =>
        a.start_date.localeCompare(b.start_date),
      ),
    })),

  lifePhaseUpdated: (phase) =>
    set((state) => ({
      lifePhases: state.lifePhases
        .map((p) => (p.id === phase.id ? phase : p))
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    })),

  lifePhaseDeleted: (id) =>
    set((state) => ({
      lifePhases: state.lifePhases.filter((p) => p.id !== id),
    })),

  // --- UI actions ---

  setActivePersonId: (id) => set({ activePersonId: id }),
  setActiveCloudType: (type) => set({ activeCloudType: type }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setError: (error) => set({ error }),

  // --- Filtered view ---

  getFilteredItems: () => {
    const state = get();
    let items = state.engramItems;

    if (state.activeCloudType) {
      items = items.filter((i) => i.cloud_type === state.activeCloudType);
    }

    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.content.toLowerCase().includes(q),
      );
    }

    return items;
  },

  // --- Reset ---

  reset: () => set(initialState),
}));
