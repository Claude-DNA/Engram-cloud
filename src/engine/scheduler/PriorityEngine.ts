// PriorityEngine.ts — decides what to process next within the budget

import type { ImportChunk } from '../import/types';
import { settingsRepository } from '../../repositories';

const PRIORITY_KEY = 'source_priority_order';

// Default source priority (higher index = lower priority)
const DEFAULT_PRIORITY: string[] = [
  'text',        // Journal / personal writing
  'whatsapp',    // Messages
  'twitter',     // Social media
  'instagram',
  'youtube',
  'google_drive',
  'dropbox',
  'icloud',
  'folder',
  'url',
];

// Signal weight by source type (personal writing > social)
const SIGNAL_WEIGHT: Record<string, number> = {
  text: 10,
  whatsapp: 8,
  twitter: 5,
  instagram: 4,
  youtube: 6,
  google_drive: 7,
  dropbox: 7,
  icloud: 7,
  folder: 6,
  url: 3,
};

export class PriorityEngine {
  private priorityOrder: string[] = DEFAULT_PRIORITY;

  async loadPriorityOrder(): Promise<string[]> {
    try {
      const raw = await settingsRepository.get(PRIORITY_KEY);
      if (raw) this.priorityOrder = JSON.parse(raw);
    } catch { /* use defaults */ }
    return this.priorityOrder;
  }

  async savePriorityOrder(order: string[]): Promise<void> {
    this.priorityOrder = order;
    await settingsRepository.set(PRIORITY_KEY, JSON.stringify(order)).catch(() => {});
  }

  getPriorityOrder(): string[] {
    return [...this.priorityOrder];
  }

  getNextBatch(chunks: ImportChunk[], budgetTokens: number): ImportChunk[] {
    if (chunks.length === 0 || budgetTokens <= 0) return [];

    // Score each chunk
    const scored = chunks.map((chunk) => ({
      chunk,
      score: this.scoreChunk(chunk),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Pack within budget
    const batch: ImportChunk[] = [];
    let tokensUsed = 0;

    for (const { chunk } of scored) {
      if (tokensUsed + chunk.tokenEstimate > budgetTokens) {
        // Try to find a smaller chunk that fits
        continue;
      }
      batch.push(chunk);
      tokensUsed += chunk.tokenEstimate;
    }

    return batch;
  }

  private scoreChunk(chunk: ImportChunk): number {
    let score = 0;
    const meta = chunk.metadata ?? {};

    // 1. RECENCY BIAS — newest content first
    const timestamp = meta.createdAt as string ?? meta.modifiedDate as string ?? '';
    if (timestamp) {
      const ageMs = Date.now() - new Date(timestamp).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      score += Math.max(0, 100 - ageDays * 0.1); // Decay over ~1000 days
    }

    // 2. HIGH-SIGNAL SOURCES — personal writing > social
    const source = meta.source as string ?? meta.platform as string ?? '';
    score += (SIGNAL_WEIGHT[source] ?? 3) * 5;

    // 3. SOURCE PRIORITY — user-configurable
    const priorityIndex = this.priorityOrder.indexOf(source);
    if (priorityIndex >= 0) {
      score += (this.priorityOrder.length - priorityIndex) * 3;
    }

    // 4. INTERACTION WEIGHT — engagement signals
    const engagement = meta.engagement as { likes?: number; reposts?: number; replies?: number } | undefined;
    if (engagement) {
      score += Math.min(20, (engagement.likes ?? 0) * 0.1 + (engagement.replies ?? 0) * 0.5);
    }

    // 5. COST EFFICIENCY — prefer smaller chunks to pack budget tightly
    if (chunk.tokenEstimate < 500) score += 5;

    return score;
  }
}

export const priorityEngine = new PriorityEngine();
