import { runMigrations } from './migrations';
import { useEngramStore } from '../stores/engramStore';
import { useAppStore } from '../store';
import { productionLoader } from '../stores/storeLoader';
import { settingsRepository } from '../repositories';
import { loadTransformationsForPerson } from '../stores/transformationService';

let initialized = false;

export async function initDatabase(): Promise<void> {
  if (initialized) return;

  await runMigrations();

  const savedTheme = await settingsRepository.get('theme');
  useAppStore.getState().initTheme(savedTheme);

  await useEngramStore.getState().hydrate(productionLoader);

  const activePersonId = useEngramStore.getState().activePersonId;
  if (activePersonId !== null) {
    await loadTransformationsForPerson(activePersonId);
  }

  initialized = true;
}

export function resetInitialized(): void {
  initialized = false;
}
