// Prompt tuner — Area 4.5
// Analyzes decision patterns and injects learned rules into prompts.

import { loadAllRecords } from './ExtractionMemory';
import type { ReviewRecord } from './ExtractionMemory';

export interface LearnedRule {
  pattern: string;
  rule: string;
  occurrences: number;
}

const MIN_OCCURRENCES = 3;

/**
 * Analyse stored review decisions and extract learnable rules.
 * Only patterns with 3+ occurrences are returned.
 */
export async function analyzePatterns(): Promise<LearnedRule[]> {
  const records = await loadAllRecords();
  const rules: LearnedRule[] = [];

  rules.push(...detectReclassificationPatterns(records));
  rules.push(...detectRejectionPatterns(records));
  rules.push(...detectTitlePatterns(records));

  return rules.filter((r) => r.occurrences >= MIN_OCCURRENCES);
}

/**
 * Build a learned-rules string to inject into extraction prompts.
 */
export async function buildLearnedRulesText(): Promise<string> {
  const rules = await analyzePatterns();
  if (rules.length === 0) return '';

  return rules.map((r) => `- ${r.rule}`).join('\n');
}

// ── Pattern detectors ─────────────────────────────────────────────────────────

function detectReclassificationPatterns(records: ReviewRecord[]): LearnedRule[] {
  // Find cases where original_cloud_type was consistently changed to accepted_cloud_type
  const counts = new Map<string, number>();

  for (const r of records) {
    if (
      r.decision === 'edit' &&
      r.originalCloudType &&
      r.acceptedCloudType &&
      r.originalCloudType !== r.acceptedCloudType
    ) {
      const key = `${r.originalCloudType}→${r.acceptedCloudType}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const rules: LearnedRule[] = [];
  for (const [key, count] of counts) {
    const [from, to] = key.split('→');
    rules.push({
      pattern: `reclassify:${key}`,
      rule: `Items classified as "${from}" are often better classified as "${to}" for this user`,
      occurrences: count,
    });
  }
  return rules;
}

function detectRejectionPatterns(records: ReviewRecord[]): LearnedRule[] {
  // Find common themes in rejected items
  const rejectedTitles = records
    .filter((r) => r.decision === 'reject' && r.originalTitle)
    .map((r) => r.originalTitle!.toLowerCase());

  const termCounts = new Map<string, number>();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is', 'was']);

  for (const title of rejectedTitles) {
    const words = title.split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w));
    for (const word of words) {
      termCounts.set(word, (termCounts.get(word) ?? 0) + 1);
    }
  }

  const rules: LearnedRule[] = [];
  for (const [term, count] of termCounts) {
    if (count >= MIN_OCCURRENCES) {
      rules.push({
        pattern: `reject_term:${term}`,
        rule: `Items about "${term}" are frequently rejected by this user — consider excluding them`,
        occurrences: count,
      });
    }
  }
  return rules;
}

function detectTitlePatterns(records: ReviewRecord[]): LearnedRule[] {
  // Detect when titles were consistently shortened or changed
  const shorteningCount = records.filter(
    (r) =>
      r.decision === 'edit' &&
      r.originalTitle &&
      r.acceptedTitle &&
      r.acceptedTitle.length < r.originalTitle.length * 0.7,
  ).length;

  if (shorteningCount >= MIN_OCCURRENCES) {
    return [
      {
        pattern: 'title_shorten',
        rule: 'This user prefers shorter, more concise titles — keep titles under 60 characters',
        occurrences: shorteningCount,
      },
    ];
  }
  return [];
}
