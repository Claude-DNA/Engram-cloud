// IngestionScheduler.ts — core scheduling engine for budget-aware ingestion

import { budgetManager } from './BudgetManager';
import { priorityEngine } from './PriorityEngine';
import type { ImportChunk } from '../import/types';

export type SchedulerState = 'idle' | 'planning' | 'processing' | 'paused' | 'budget_exhausted';

export interface SchedulerActivity {
  timestamp: string;
  message: string;
  source?: string;
  tokensUsed?: number;
}

export interface SchedulerCallbacks {
  onStateChange: (state: SchedulerState) => void;
  onProgress: (processed: number, total: number) => void;
  onActivity: (activity: SchedulerActivity) => void;
  processChunk: (chunk: ImportChunk) => Promise<{ tokensUsed: number; cost: number; itemsExtracted: number }>;
}

export class IngestionScheduler {
  private state: SchedulerState = 'idle';
  private pendingChunks: ImportChunk[] = [];
  private processedCount = 0;
  private callbacks: SchedulerCallbacks | null = null;
  private activities: SchedulerActivity[] = [];

  getState(): SchedulerState {
    return this.state;
  }

  getActivities(): SchedulerActivity[] {
    return [...this.activities];
  }

  getProgress(): { processed: number; total: number } {
    return { processed: this.processedCount, total: this.pendingChunks.length + this.processedCount };
  }

  setCallbacks(callbacks: SchedulerCallbacks): void {
    this.callbacks = callbacks;
  }

  enqueueChunks(chunks: ImportChunk[]): void {
    this.pendingChunks.push(...chunks);
  }

  clearQueue(): void {
    this.pendingChunks = [];
    this.processedCount = 0;
  }

  async start(): Promise<void> {
    if (this.state === 'processing') return;

    await budgetManager.load();
    await priorityEngine.loadPriorityOrder();

    this.setState('processing');
    await this.run();
  }

  pause(): void {
    this.setState('paused');
  }

  async resume(): Promise<void> {
    if (this.state !== 'paused' && this.state !== 'budget_exhausted') return;
    this.setState('processing');
    await this.run();
  }

  burst(extraTokens: number): void {
    budgetManager.addBurstBudget(extraTokens);
    this.addActivity({
      timestamp: new Date().toISOString(),
      message: `Burst mode: +${extraTokens.toLocaleString()} tokens added`,
    });
    if (this.state === 'budget_exhausted') {
      this.resume();
    }
  }

  private async run(): Promise<void> {
    while (this.state === 'processing') {
      // Check budget
      const remaining = budgetManager.remainingToday();
      if (remaining <= 0) {
        this.setState('budget_exhausted');
        this.addActivity({
          timestamp: new Date().toISOString(),
          message: 'Daily budget reached. Resuming tomorrow.',
        });
        return;
      }

      // Get next batch from priority engine
      const batch = priorityEngine.getNextBatch(this.pendingChunks, remaining);
      if (batch.length === 0) {
        this.setState('idle');
        this.addActivity({
          timestamp: new Date().toISOString(),
          message: 'All connected sources fully processed!',
        });
        return;
      }

      // Process batch
      for (const chunk of batch) {
        if (this.state !== 'processing') return;

        try {
          const result = await this.callbacks?.processChunk(chunk);
          if (result) {
            budgetManager.recordUsage(result.tokensUsed, result.cost);
          }

          // Remove from pending
          const idx = this.pendingChunks.indexOf(chunk);
          if (idx >= 0) this.pendingChunks.splice(idx, 1);
          this.processedCount++;

          const source = (chunk.metadata?.source as string) ?? (chunk.metadata?.platform as string) ?? 'unknown';
          this.addActivity({
            timestamp: new Date().toISOString(),
            message: `Processed chunk from ${source}`,
            source,
            tokensUsed: result?.tokensUsed,
          });

          this.callbacks?.onProgress(this.processedCount, this.pendingChunks.length + this.processedCount);
        } catch (err) {
          this.addActivity({
            timestamp: new Date().toISOString(),
            message: `Error: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }

      // Brief pause between batches
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  private setState(state: SchedulerState): void {
    this.state = state;
    this.callbacks?.onStateChange(state);
  }

  private addActivity(activity: SchedulerActivity): void {
    this.activities.unshift(activity);
    if (this.activities.length > 100) this.activities.length = 100;
    this.callbacks?.onActivity(activity);
  }
}

export const ingestionScheduler = new IngestionScheduler();
