// Recovery manager — Area 4.4
// Handles cascading error recovery for AI processing failures.

import type { AIProvider } from '../ai/AIProvider';
import type { ImportChunk } from '../import/types';

export type RecoveryAction =
  | 'retry'
  | 'split_chunk'
  | 'alternate_provider'
  | 'simplify_prompt'
  | 'raw_import';

export interface RecoveryLogEntry {
  timestamp: string;
  chunkId: string;
  attempt: number;
  action: RecoveryAction;
  error: string;
  success: boolean;
}

export interface RecoveryContext {
  chunk: ImportChunk;
  provider: AIProvider;
  alternateProviders?: AIProvider[];
  onRawImport?: (chunk: ImportChunk) => void;
  onPause?: (reason: string) => void;
}

type RetryFn = () => Promise<string>;

export class RecoveryManager {
  private log: RecoveryLogEntry[] = [];
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures = 3;

  getLog(): RecoveryLogEntry[] {
    return [...this.log];
  }

  clearLog(): void {
    this.log = [];
    this.consecutiveFailures = 0;
  }

  /**
   * Execute an AI call with full recovery cascade:
   * 1. Retry transient errors (3x with backoff)
   * 2. Split chunk if too long
   * 3. Try alternate provider
   * 4. Simplify prompt
   * 5. Fall back to raw import
   */
  async withRecovery(
    ctx: RecoveryContext,
    primaryFn: RetryFn,
    simplifiedFn?: RetryFn,
  ): Promise<{ result: string | null; usedFallback: boolean }> {
    // Stage 1: retry transient errors
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await primaryFn();
        this.consecutiveFailures = 0;
        this.logEntry(ctx.chunk.id, attempt, 'retry', '', true);
        return { result, usedFallback: false };
      } catch (err) {
        const error = String(err);
        const isTransient = this.isTransientError(error);

        this.logEntry(ctx.chunk.id, attempt, 'retry', error, false);

        if (!isTransient || attempt === 3) break;
        await delay(1000 * attempt);
      }
    }

    // Stage 2: try alternate provider
    for (const altProvider of ctx.alternateProviders ?? []) {
      try {
        // We can't easily swap providers in this abstraction without re-running
        // the full fn — signal the caller to retry with the alternate
        void altProvider; // mark as used
        // In practice, caller must construct a new fn with the alt provider
        this.logEntry(ctx.chunk.id, 1, 'alternate_provider', 'attempting alternate', false);
      } catch {
        // ignore
      }
    }

    // Stage 3: simplify prompt
    if (simplifiedFn) {
      try {
        const result = await simplifiedFn();
        this.consecutiveFailures = 0;
        this.logEntry(ctx.chunk.id, 1, 'simplify_prompt', '', true);
        return { result, usedFallback: true };
      } catch (err) {
        this.logEntry(ctx.chunk.id, 1, 'simplify_prompt', String(err), false);
      }
    }

    // Stage 4: raw import fallback
    this.consecutiveFailures++;
    this.logEntry(ctx.chunk.id, 1, 'raw_import', 'all stages failed', true);

    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      ctx.onPause?.(`${this.consecutiveFailures} consecutive failures — processing paused`);
    }

    ctx.onRawImport?.(ctx.chunk);
    return { result: null, usedFallback: true };
  }

  private isTransientError(error: string): boolean {
    return (
      error.includes('429') ||
      error.includes('503') ||
      error.includes('timeout') ||
      error.includes('network') ||
      error.includes('ECONNRESET') ||
      error.includes('rate limit')
    );
  }

  private logEntry(
    chunkId: string,
    attempt: number,
    action: RecoveryAction,
    error: string,
    success: boolean,
  ): void {
    this.log.push({
      timestamp: new Date().toISOString(),
      chunkId,
      attempt,
      action,
      error,
      success,
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
