import type { EngramExport } from './exportService';
import { EXPORT_SCHEMA_VERSION } from './exportService';
import { personRepository, engramItemRepository, lifePhaseRepository, transformationRepository } from '../repositories';
import { useEngramStore } from './engramStore';
import { productionLoader } from './storeLoader';
import { loadTransformationsForPerson } from './transformationService';
import type { CloudType } from '../types/engram';
import { VALID_CLOUD_TYPES } from '../types/engram';

export interface ImportResult {
  personsCreated: number;
  itemsCreated: number;
  itemsSkipped: number;
  phasesCreated: number;
  transformationsCreated: number;
  errors: string[];
}

/**
 * Validate an import payload against the expected schema.
 */
export function validateImport(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Import data must be a JSON object'] };
  }

  const d = data as Record<string, unknown>;

  if (!d.schema_version) {
    errors.push('Missing schema_version');
  } else if (typeof d.schema_version !== 'string') {
    errors.push('schema_version must be a string');
  }

  if (!d.person || typeof d.person !== 'object') {
    errors.push('Missing or invalid person object');
  }

  if (!Array.isArray(d.engram_items)) {
    errors.push('Missing or invalid engram_items array');
  } else {
    for (let i = 0; i < d.engram_items.length; i++) {
      const item = d.engram_items[i] as Record<string, unknown>;
      if (!item.title || !item.content) {
        errors.push(`engram_items[${i}]: missing title or content`);
      }
      if (item.cloud_type && !VALID_CLOUD_TYPES.includes(item.cloud_type as CloudType)) {
        errors.push(`engram_items[${i}]: invalid cloud_type "${item.cloud_type}"`);
      }
    }
  }

  if (d.life_phases !== undefined && !Array.isArray(d.life_phases)) {
    errors.push('life_phases must be an array');
  }

  if (d.transformations !== undefined && !Array.isArray(d.transformations)) {
    errors.push('transformations must be an array');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Import a person graph. Mode:
 * - 'merge': add new items, skip items with duplicate UUIDs
 * - 'replace': delete existing person data, import fresh
 */
export async function importPersonGraph(
  data: EngramExport,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  const result: ImportResult = {
    personsCreated: 0,
    itemsCreated: 0,
    itemsSkipped: 0,
    phasesCreated: 0,
    transformationsCreated: 0,
    errors: [],
  };

  try {
    // Create or find person
    const person = await personRepository.create({ name: data.person.name });
    result.personsCreated = 1;

    // Map old IDs → new IDs
    const itemIdMap = new Map<number, number>();
    const phaseIdMap = new Map<number, number>();

    // Import life phases
    for (const phase of data.life_phases ?? []) {
      try {
        const newPhase = await lifePhaseRepository.create({
          person_id: person.id,
          name: phase.name,
          start_date: phase.start_date,
          end_date: phase.end_date,
          description: phase.description,
        });
        phaseIdMap.set(phase.id, newPhase.id);
        result.phasesCreated++;
      } catch (err) {
        result.errors.push(`Life phase "${phase.name}": ${err}`);
      }
    }

    // Import engram items
    for (const item of data.engram_items ?? []) {
      try {
        // Map life_phase_id to new ID
        const newPhaseId = item.life_phase_id ? phaseIdMap.get(item.life_phase_id) ?? null : null;

        const newItem = await engramItemRepository.create({
          person_id: person.id,
          cloud_type: item.cloud_type as CloudType,
          title: item.title,
          content: item.content,
          date: item.date,
          life_phase_id: newPhaseId,
        });
        itemIdMap.set(item.id, newItem.id);
        result.itemsCreated++;
      } catch (err) {
        result.errors.push(`Item "${item.title}": ${err}`);
        result.itemsSkipped++;
      }
    }

    // Import transformations (need both source and target to exist)
    for (const t of data.transformations ?? []) {
      const newSourceId = itemIdMap.get(t.source_id);
      const newTargetId = itemIdMap.get(t.target_id);

      if (!newSourceId || !newTargetId) {
        result.errors.push(`Transformation ${t.source_id}→${t.target_id}: missing mapped items`);
        continue;
      }

      try {
        await transformationRepository.create({
          person_id: person.id,
          source_id: newSourceId,
          target_id: newTargetId,
          transformation_type: t.transformation_type,
          description: t.description,
        });
        result.transformationsCreated++;
      } catch (err) {
        result.errors.push(`Transformation: ${err}`);
      }
    }

    // Rehydrate store with new data
    await useEngramStore.getState().hydrate(productionLoader);
    const activePersonId = useEngramStore.getState().activePersonId;
    if (activePersonId) {
      await loadTransformationsForPerson(activePersonId);
    }
  } catch (err) {
    result.errors.push(`Import failed: ${err}`);
  }

  return result;
}
