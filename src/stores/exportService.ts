import { personRepository, engramItemRepository, lifePhaseRepository, transformationRepository } from '../repositories';
import { getTransformations } from './transformationService';
import type { Person, EngramItem, LifePhase, Transformation } from '../types/engram';

/**
 * Export schema version — bump on breaking changes to export format.
 */
export const EXPORT_SCHEMA_VERSION = '1.0.0';

export interface EngramExport {
  schema_version: string;
  exported_at: string;
  app_version: string;
  person: Person;
  engram_items: EngramItem[];
  life_phases: LifePhase[];
  transformations: Transformation[];
}

/**
 * Export a complete person graph as JSON.
 * Includes all engrams (even soft-deleted for recovery), life phases, and transformations.
 */
export async function exportPersonGraph(personId: number): Promise<EngramExport> {
  const person = await personRepository.findById(personId);
  if (!person) throw new Error(`Person with id ${personId} not found`);

  const items = await engramItemRepository.list({ person_id: personId });
  const phases = await lifePhaseRepository.listByPerson(personId);
  const transformations = getTransformations().filter(
    (t) => t.person_id === personId,
  );

  return {
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    app_version: '0.1.0',
    person,
    engram_items: items,
    life_phases: phases,
    transformations,
  };
}

/**
 * Export as CSV for a specific cloud type.
 */
export async function exportCloudTypeCSV(
  personId: number,
  cloudType?: string,
): Promise<string> {
  const filters: { person_id: number; cloud_type?: any } = { person_id: personId };
  if (cloudType) filters.cloud_type = cloudType;

  const items = await engramItemRepository.list(filters);

  const headers = ['id', 'uuid', 'cloud_type', 'title', 'content', 'date', 'life_phase_id', 'created_at'];
  const rows = items.map((item) =>
    headers.map((h) => {
      const val = (item as any)[h];
      if (val === null || val === undefined) return '';
      // Escape CSV: wrap in quotes if contains comma, newline, or quote
      const str = String(val);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export as readable Markdown, organized by cloud type.
 */
export async function exportMarkdown(personId: number): Promise<string> {
  const person = await personRepository.findById(personId);
  if (!person) throw new Error(`Person with id ${personId} not found`);

  const items = await engramItemRepository.list({ person_id: personId });
  const phases = await lifePhaseRepository.listByPerson(personId);
  const transformations = getTransformations().filter(
    (t) => t.person_id === personId,
  );

  const lines: string[] = [];
  lines.push(`# ${person.name} — Engram Cloud Export`);
  lines.push(`*Exported ${new Date().toISOString()}*\n`);

  // Life phases
  if (phases.length > 0) {
    lines.push('## Life Phases\n');
    for (const p of phases) {
      lines.push(`### ${p.name}`);
      lines.push(`${p.start_date} → ${p.end_date ?? 'present'}`);
      if (p.description) lines.push(p.description);
      lines.push('');
    }
  }

  // Group items by cloud type
  const byType = new Map<string, EngramItem[]>();
  for (const item of items) {
    if (!byType.has(item.cloud_type)) byType.set(item.cloud_type, []);
    byType.get(item.cloud_type)!.push(item);
  }

  const typeLabels: Record<string, string> = {
    memory: '🧠 Memories',
    knowledge: '📚 Knowledge',
    belief: '✨ Beliefs',
    value: '💎 Values',
    skill: '🛠 Skills',
    goal: '🎯 Goals',
    reflection: '🪞 Reflections',
  };

  for (const [type, typeItems] of byType) {
    lines.push(`## ${typeLabels[type] ?? type}\n`);
    for (const item of typeItems) {
      lines.push(`### ${item.title}`);
      if (item.date) lines.push(`*${item.date}*`);
      lines.push(item.content);

      // Show linked items
      const outLinks = transformations.filter((t) => t.source_id === item.id);
      const inLinks = transformations.filter((t) => t.target_id === item.id);
      if (outLinks.length > 0 || inLinks.length > 0) {
        lines.push('\n**Connections:**');
        for (const t of outLinks) {
          const target = items.find((i) => i.id === t.target_id);
          if (target) lines.push(`- → ${t.transformation_type}: ${target.title}`);
        }
        for (const t of inLinks) {
          const source = items.find((i) => i.id === t.source_id);
          if (source) lines.push(`- ← ${t.transformation_type}: ${source.title}`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
