// SourceSurveyor.ts — estimates total volume across all connected sources

import { budgetManager } from './BudgetManager';

export interface ConnectedSource {
  name: string;
  type: 'cloud' | 'social' | 'folder' | 'url';
  platform?: string;
  estimatedItems: number;
  lastSyncAt?: string;
}

export interface SourceEstimate {
  source: string;
  type: string;
  platform?: string;
  estimatedItems: number;
  estimatedChunks: number;
  estimatedTokens: number;
  estimatedCost: number;
  dateRange?: { oldest?: string; newest?: string };
  lastSynced?: string;
}

export interface IngestionPlan {
  sources: SourceEstimate[];
  totalItems: number;
  totalChunks: number;
  totalTokens: number;
  totalCost: number;
  estimatedDaysAtBudget: number;
  estimatedMonthsAtBudget: number;
}

// Average tokens per item by source type
const TOKENS_PER_ITEM: Record<string, number> = {
  twitter: 80,
  instagram: 40,
  youtube: 500,
  google_drive: 1500,
  dropbox: 1500,
  icloud: 1500,
  folder: 800,
  url: 600,
};

// Average chunks per item (some items span multiple chunks)
const CHUNKS_PER_ITEM: Record<string, number> = {
  twitter: 1,
  instagram: 1,
  youtube: 3,
  google_drive: 4,
  dropbox: 4,
  icloud: 4,
  folder: 2,
  url: 2,
};

export class SourceSurveyor {
  estimateSource(source: ConnectedSource): SourceEstimate {
    const key = source.platform ?? source.type;
    const tokensPerItem = TOKENS_PER_ITEM[key] ?? 200;
    const chunksPerItem = CHUNKS_PER_ITEM[key] ?? 1;

    const estimatedChunks = Math.ceil(source.estimatedItems * chunksPerItem);
    const estimatedTokens = Math.ceil(source.estimatedItems * tokensPerItem);
    const estimatedCost = budgetManager.estimateCost(estimatedTokens);

    return {
      source: source.name,
      type: source.type,
      platform: source.platform,
      estimatedItems: source.estimatedItems,
      estimatedChunks,
      estimatedTokens,
      estimatedCost,
      lastSynced: source.lastSyncAt,
    };
  }

  surveyAll(sources: ConnectedSource[]): IngestionPlan {
    const estimates = sources.map((s) => this.estimateSource(s));

    const totalItems = estimates.reduce((sum, e) => sum + e.estimatedItems, 0);
    const totalChunks = estimates.reduce((sum, e) => sum + e.estimatedChunks, 0);
    const totalTokens = estimates.reduce((sum, e) => sum + e.estimatedTokens, 0);
    const totalCost = estimates.reduce((sum, e) => sum + e.estimatedCost, 0);

    const budget = budgetManager.getSettings();
    const estimatedDaysAtBudget = budget.dailyTokenCap === Infinity
      ? 1
      : Math.ceil(totalTokens / budget.dailyTokenCap);
    const estimatedMonthsAtBudget = budget.monthlyCostCap === Infinity
      ? 1
      : Math.ceil(totalCost / budget.monthlyCostCap);

    return {
      sources: estimates,
      totalItems,
      totalChunks,
      totalTokens,
      totalCost,
      estimatedDaysAtBudget,
      estimatedMonthsAtBudget,
    };
  }
}

export const sourceSurveyor = new SourceSurveyor();
