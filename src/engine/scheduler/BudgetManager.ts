// BudgetManager.ts — token/cost budget tracking for ingestion scheduler

import { settingsRepository } from '../../repositories';

export interface BudgetSettings {
  dailyTokenCap: number;
  monthlyCostCap: number;
  mode: 'conservative' | 'balanced' | 'unlimited' | 'custom';
}

const MODE_DEFAULTS: Record<string, { dailyTokenCap: number; monthlyCostCap: number }> = {
  conservative: { dailyTokenCap: 10_000, monthlyCostCap: 5.00 },
  balanced: { dailyTokenCap: 30_000, monthlyCostCap: 15.00 },
  unlimited: { dailyTokenCap: Infinity, monthlyCostCap: Infinity },
};

const BUDGET_KEY = 'scheduler_budget';
const USAGE_KEY = 'scheduler_usage';

interface UsageData {
  tokensUsedToday: number;
  costUsedThisMonth: number;
  lastDayReset: string; // YYYY-MM-DD
  lastMonthReset: string; // YYYY-MM
  burstBudget: number;
}

export class BudgetManager {
  private settings: BudgetSettings = { dailyTokenCap: 10_000, monthlyCostCap: 5.00, mode: 'conservative' };
  private usage: UsageData = {
    tokensUsedToday: 0,
    costUsedThisMonth: 0,
    lastDayReset: new Date().toISOString().slice(0, 10),
    lastMonthReset: new Date().toISOString().slice(0, 7),
    burstBudget: 0,
  };

  async load(): Promise<void> {
    try {
      const raw = await settingsRepository.get(BUDGET_KEY);
      if (raw) this.settings = JSON.parse(raw);
    } catch { /* use defaults */ }
    try {
      const raw = await settingsRepository.get(USAGE_KEY);
      if (raw) this.usage = JSON.parse(raw);
    } catch { /* use defaults */ }
    this.checkResets();
  }

  async save(): Promise<void> {
    await settingsRepository.set(BUDGET_KEY, JSON.stringify(this.settings)).catch(() => {});
    await settingsRepository.set(USAGE_KEY, JSON.stringify(this.usage)).catch(() => {});
  }

  getSettings(): BudgetSettings {
    return { ...this.settings };
  }

  async updateSettings(patch: Partial<BudgetSettings>): Promise<void> {
    if (patch.mode && patch.mode !== 'custom' && MODE_DEFAULTS[patch.mode]) {
      const defaults = MODE_DEFAULTS[patch.mode];
      this.settings = { ...this.settings, ...defaults, ...patch };
    } else {
      this.settings = { ...this.settings, ...patch };
    }
    await this.save();
  }

  private checkResets(): void {
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = new Date().toISOString().slice(0, 7);

    if (this.usage.lastDayReset !== today) {
      this.usage.tokensUsedToday = 0;
      this.usage.burstBudget = 0;
      this.usage.lastDayReset = today;
    }
    if (this.usage.lastMonthReset !== thisMonth) {
      this.usage.costUsedThisMonth = 0;
      this.usage.lastMonthReset = thisMonth;
    }
  }

  canProcess(estimatedTokens: number): { allowed: boolean; reason?: string } {
    this.checkResets();

    const effectiveDailyCap = this.settings.dailyTokenCap + this.usage.burstBudget;

    if (this.usage.tokensUsedToday + estimatedTokens > effectiveDailyCap) {
      return {
        allowed: false,
        reason: `Daily cap reached (${effectiveDailyCap.toLocaleString()} tokens). Resumes tomorrow.`,
      };
    }

    const estimatedCost = this.estimateCost(estimatedTokens);
    if (this.usage.costUsedThisMonth + estimatedCost > this.settings.monthlyCostCap) {
      return {
        allowed: false,
        reason: `Monthly budget reached ($${this.settings.monthlyCostCap.toFixed(2)}). Increase budget or wait until next month.`,
      };
    }

    return { allowed: true };
  }

  estimateCost(tokens: number): number {
    // Use conservative estimate based on Gemini rates (cheapest)
    return (tokens / 1_000_000) * 0.075 + (tokens / 1_000_000) * 0.30;
  }

  recordUsage(tokensUsed: number, cost: number): void {
    this.checkResets();
    this.usage.tokensUsedToday += tokensUsed;
    this.usage.costUsedThisMonth += cost;
    this.save().catch(() => {});
  }

  addBurstBudget(extraTokens: number): void {
    this.usage.burstBudget += extraTokens;
    this.save().catch(() => {});
  }

  remainingToday(): number {
    this.checkResets();
    return Math.max(0, this.settings.dailyTokenCap + this.usage.burstBudget - this.usage.tokensUsedToday);
  }

  remainingThisMonth(): number {
    this.checkResets();
    const usedCost = this.usage.costUsedThisMonth;
    const capCost = this.settings.monthlyCostCap;
    return Math.max(0, capCost - usedCost);
  }

  getUsage(): { tokensToday: number; costThisMonth: number; dailyCap: number; monthlyCap: number; burstBudget: number } {
    this.checkResets();
    return {
      tokensToday: this.usage.tokensUsedToday,
      costThisMonth: this.usage.costUsedThisMonth,
      dailyCap: this.settings.dailyTokenCap,
      monthlyCap: this.settings.monthlyCostCap,
      burstBudget: this.usage.burstBudget,
    };
  }
}

export const budgetManager = new BudgetManager();
