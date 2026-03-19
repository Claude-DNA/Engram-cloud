// Cost governor — Area 4.3
// Tracks session token usage and controls whether AI calls can proceed.

export type BudgetMode = 'conservative' | 'balanced' | 'unlimited';

interface ProviderRates {
  inputPer1M: number;   // USD per 1M input tokens
  outputPer1M: number;  // USD per 1M output tokens
}

const PROVIDER_RATES: Record<string, ProviderRates> = {
  gemini: { inputPer1M: 0.075, outputPer1M: 0.30 },
  openai: { inputPer1M: 2.50, outputPer1M: 10.00 },
  anthropic: { inputPer1M: 3.00, outputPer1M: 15.00 },
};

const BUDGET_LIMITS: Record<BudgetMode, number> = {
  conservative: 1.00,
  balanced: 5.00,
  unlimited: Infinity,
};

export type GovernorDecision =
  | { proceed: true; downgradeToQuick: boolean }
  | { proceed: false; reason: string };

export class CostGovernor {
  private sessionInputTokens = 0;
  private sessionOutputTokens = 0;
  private sessionCost = 0;
  private mode: BudgetMode;
  private paused = false;
  private onPause?: () => void;

  constructor(mode: BudgetMode = 'conservative', onPause?: () => void) {
    this.mode = mode;
    this.onPause = onPause;
  }

  setMode(mode: BudgetMode): void {
    this.mode = mode;
    this.paused = false;
  }

  get budget(): number {
    return BUDGET_LIMITS[this.mode];
  }

  get usedCost(): number {
    return this.sessionCost;
  }

  get usedTokens(): number {
    return this.sessionInputTokens + this.sessionOutputTokens;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  resume(): void {
    this.paused = false;
  }

  /** Estimate USD cost for a given token count with a specific provider. */
  estimateCost(inputTokens: number, outputTokens: number, provider: string): number {
    const rates = PROVIDER_RATES[provider] ?? PROVIDER_RATES['gemini'];
    return (inputTokens / 1_000_000) * rates.inputPer1M +
           (outputTokens / 1_000_000) * rates.outputPer1M;
  }

  /**
   * Check whether an AI call should proceed.
   * Returns proceed=false if paused or budget exceeded.
   * Returns downgradeToQuick=true when at 70% of budget.
   */
  canProceed(estimatedInputTokens: number, estimatedOutputTokens: number, provider: string): GovernorDecision {
    if (this.paused) {
      return { proceed: false, reason: 'Processing paused by cost governor' };
    }

    const limit = BUDGET_LIMITS[this.mode];
    if (limit === Infinity) {
      return { proceed: true, downgradeToQuick: false };
    }

    const estimatedCost = this.estimateCost(estimatedInputTokens, estimatedOutputTokens, provider);
    const projected = this.sessionCost + estimatedCost;
    const ratio = projected / limit;

    if (ratio >= 0.95) {
      this.paused = true;
      this.onPause?.();
      return { proceed: false, reason: `Budget limit reached (${(this.sessionCost).toFixed(4)} / $${limit.toFixed(2)})` };
    }

    return { proceed: true, downgradeToQuick: ratio >= 0.70 };
  }

  /** Record actual usage after an AI call. */
  recordUsage(inputTokens: number, outputTokens: number, provider: string): void {
    this.sessionInputTokens += inputTokens;
    this.sessionOutputTokens += outputTokens;
    this.sessionCost += this.estimateCost(inputTokens, outputTokens, provider);
  }

  /** Pre-import cost estimate for a given chunk count and average tokens per chunk. */
  estimateImportCost(
    chunkCount: number,
    avgTokensPerChunk: number,
    provider: string,
    quickMode: boolean,
  ): { estimatedCost: number; estimatedTokens: number } {
    const callsPerChunk = quickMode ? 3 : 9;
    const inputTokens = chunkCount * callsPerChunk * avgTokensPerChunk;
    const outputTokens = chunkCount * callsPerChunk * 800; // avg output per call
    return {
      estimatedCost: this.estimateCost(inputTokens, outputTokens, provider),
      estimatedTokens: inputTokens + outputTokens,
    };
  }

  reset(): void {
    this.sessionInputTokens = 0;
    this.sessionOutputTokens = 0;
    this.sessionCost = 0;
    this.paused = false;
  }

  getSnapshot() {
    return {
      sessionInputTokens: this.sessionInputTokens,
      sessionOutputTokens: this.sessionOutputTokens,
      sessionCost: this.sessionCost,
      budget: this.budget,
      mode: this.mode,
      paused: this.paused,
    };
  }
}
