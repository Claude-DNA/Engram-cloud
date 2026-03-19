// Semantic deduplication — Area 4.7
// Trigram similarity for title + content + temporal overlap.

import { diffStates } from '../state/StateDiffEngine';

export interface DedupCandidate {
  id: string;
  title: string;
  content: string;
  date?: string | null;
  stateData?: Record<string, unknown> | null;
}

export interface DedupResult {
  itemId: string;
  possibleDuplicateOf: string;
  score: number;
  /** If true, route to StateDiffEngine as transformation instead of merge */
  isTransformationCandidate: boolean;
}

/** Generate character trigrams from a string */
function trigrams(str: string): Set<string> {
  const normalized = str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const set = new Set<string>();
  for (let i = 0; i < normalized.length - 2; i++) {
    set.add(normalized.slice(i, i + 3));
  }
  return set;
}

/** Dice coefficient between two trigram sets */
function trigramSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  return (2 * intersection) / (a.size + b.size);
}

/**
 * Years between two ISO date strings. Returns null if either is missing.
 */
function yearsBetween(dateA: string | null | undefined, dateB: string | null | undefined): number | null {
  if (!dateA || !dateB) return null;
  const a = new Date(dateA).getFullYear();
  const b = new Date(dateB).getFullYear();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.abs(a - b);
}

/**
 * Temporal overlap score (0-1).
 * Same year = 1.0, 1 year apart = 0.7, 2 years = 0.4, >2 years = 0.0
 */
function temporalScore(dateA: string | null | undefined, dateB: string | null | undefined): number {
  const years = yearsBetween(dateA, dateB);
  if (years === null) return 0.5; // unknown — neutral
  if (years === 0) return 1.0;
  if (years === 1) return 0.7;
  if (years === 2) return 0.4;
  return 0.0;
}

/**
 * Check all items for possible duplicates.
 * Returns pairs scored above 0.75.
 */
export function findDuplicates(items: DedupCandidate[]): DedupResult[] {
  const results: DedupResult[] = [];
  const seen = new Set<string>();

  // Precompute trigrams
  const titleTrigrams = items.map((item) => trigrams(item.title));
  const contentTrigrams = items.map((item) => trigrams(item.content));

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const pairKey = `${items[i].id}:${items[j].id}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const titleSim = trigramSimilarity(titleTrigrams[i], titleTrigrams[j]);
      const contentSim = trigramSimilarity(contentTrigrams[i], contentTrigrams[j]);
      const tempScore = temporalScore(items[i].date, items[j].date);

      // Weighted composite: title 40%, content 40%, temporal 20%
      const composite = titleSim * 0.4 + contentSim * 0.4 + tempScore * 0.2;

      if (composite < 0.75) continue;

      // Temporal conflict guard: similar items >2 years apart → transformation candidate
      const years = yearsBetween(items[i].date, items[j].date);
      const isTransformationCandidate = years !== null && years > 2;

      if (isTransformationCandidate) {
        // Cross-check with StateDiffEngine for stronger evidence
        const diff = diffStates(
          items[i].stateData as never ?? null,
          items[j].stateData as never ?? null,
        );
        if (diff.isTransformation) {
          results.push({
            itemId: items[i].id,
            possibleDuplicateOf: items[j].id,
            score: composite,
            isTransformationCandidate: true,
          });
          continue;
        }
      }

      results.push({
        itemId: items[i].id,
        possibleDuplicateOf: items[j].id,
        score: composite,
        isTransformationCandidate: false,
      });
    }
  }

  return results;
}

/** Classify a score */
export function dedupLabel(score: number): 'likely_duplicate' | 'possible_duplicate' | 'unique' {
  if (score >= 0.9) return 'likely_duplicate';
  if (score >= 0.75) return 'possible_duplicate';
  return 'unique';
}
