import { transformationRepository } from '../repositories';
import type { Transformation } from '../types/engram';

/**
 * Transformation service — DB-first writes for engram linking.
 */

// In-memory cache of loaded transformations (lightweight, no Zustand needed for v1)
let _transformationsCache: Transformation[] = [];
let _listeners: Array<() => void> = [];

export function getTransformations(): Transformation[] {
  return _transformationsCache;
}

export function onTransformationsChange(listener: () => void): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

function notify() {
  _listeners.forEach((l) => l());
}

export async function loadTransformationsForPerson(personId: number): Promise<Transformation[]> {
  _transformationsCache = await transformationRepository.listByPerson(personId);
  notify();
  return _transformationsCache;
}

export async function createTransformation(data: {
  person_id: number;
  source_id: number;
  target_id: number;
  transformation_type: string;
  description?: string | null;
}): Promise<Transformation> {
  const t = await transformationRepository.create(data);
  _transformationsCache = [..._transformationsCache, t];
  notify();
  return t;
}

export async function deleteTransformation(id: number): Promise<void> {
  await transformationRepository.delete(id);
  _transformationsCache = _transformationsCache.filter((t) => t.id !== id);
  notify();
}

/**
 * Get all transformations connected to a given engram item.
 * Returns both forward (as source) and inverse (as target) links.
 */
export function getLinksForItem(itemId: number): {
  forward: Transformation[];
  inverse: Transformation[];
} {
  return {
    forward: _transformationsCache.filter((t) => t.source_id === itemId),
    inverse: _transformationsCache.filter((t) => t.target_id === itemId),
  };
}
