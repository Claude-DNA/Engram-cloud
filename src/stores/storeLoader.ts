import type { StoreLoader } from './engramStore';
import type { EngramItemFilters } from '../repositories';
import type { EngramItem, Person, LifePhase } from '../types/engram';
import { personRepository } from '../repositories';
import { engramItemRepository } from '../repositories';
import { lifePhaseRepository } from '../repositories';

/**
 * Production StoreLoader — connects Zustand to SQLite via repositories.
 * Used in main.tsx for hydration and in components for loadMore/rehydration.
 */
export const productionLoader: StoreLoader = {
  loadPersons: async (): Promise<Person[]> => {
    return personRepository.list();
  },

  loadEngramItems: async (
    filters: EngramItemFilters & { limit: number; offset: number },
  ): Promise<EngramItem[]> => {
    return engramItemRepository.list(filters);
  },

  loadLifePhases: async (personId: number): Promise<LifePhase[]> => {
    return lifePhaseRepository.listByPerson(personId);
  },
};
