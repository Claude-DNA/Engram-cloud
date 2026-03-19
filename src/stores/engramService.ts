import { useEngramStore } from './engramStore';
import { engramItemRepository } from '../repositories';
import { personRepository } from '../repositories';
import { lifePhaseRepository } from '../repositories';
import type { CloudType } from '../types/engram';

/**
 * Engram Service — coordinates DB writes + surgical store updates.
 *
 * Pattern: DB write first → on success → update Zustand.
 * If DB write fails → throw (store unchanged, UI consistent).
 * Consumers call these instead of touching repos or store directly.
 */

export async function createEngramItem(data: {
  person_id: number;
  cloud_type: CloudType;
  title: string;
  content: string;
  date?: string | null;
  life_phase_id?: number | null;
}) {
  const item = await engramItemRepository.create(data);
  useEngramStore.getState().itemCreated(item);
  return item;
}

export async function updateEngramItem(
  id: number,
  data: Partial<{
    title: string;
    content: string;
    date: string | null;
    life_phase_id: number | null;
    cloud_type: CloudType;
  }>,
) {
  const item = await engramItemRepository.update(id, data);
  if (item) {
    useEngramStore.getState().itemUpdated(item);
  }
  return item;
}

export async function deleteEngramItem(id: number) {
  await engramItemRepository.softDelete(id);
  useEngramStore.getState().itemDeleted(id);
}

export async function createPerson(data: { name: string }) {
  const person = await personRepository.create(data);
  useEngramStore.getState().personCreated(person);
  return person;
}

export async function updatePerson(id: number, data: Partial<{ name: string }>) {
  const person = await personRepository.update(id, data);
  if (person) {
    useEngramStore.getState().personUpdated(person);
  }
  return person;
}

export async function deletePerson(id: number) {
  await personRepository.softDelete(id);
  useEngramStore.getState().personDeleted(id);
}

export async function createLifePhase(data: {
  person_id: number;
  name: string;
  start_date: string;
  end_date?: string | null;
  description?: string | null;
}) {
  const phase = await lifePhaseRepository.create(data);
  useEngramStore.getState().lifePhaseCreated(phase);
  return phase;
}

export async function updateLifePhase(
  id: number,
  data: Partial<{
    name: string;
    start_date: string;
    end_date: string | null;
    description: string | null;
  }>,
) {
  const phase = await lifePhaseRepository.update(id, data);
  if (phase) {
    useEngramStore.getState().lifePhaseUpdated(phase);
  }
  return phase;
}

export async function deleteLifePhase(id: number) {
  await lifePhaseRepository.delete(id);
  useEngramStore.getState().lifePhaseDeleted(id);
}
