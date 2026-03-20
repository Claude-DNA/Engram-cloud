// schedulerStore.ts — Zustand store for scheduler state management

import { create } from 'zustand';
import { budgetManager, type BudgetSettings } from '../engine/scheduler/BudgetManager';
import { ingestionScheduler, type SchedulerState, type SchedulerActivity } from '../engine/scheduler/IngestionScheduler';
import { sourceSurveyor, type ConnectedSource, type IngestionPlan } from '../engine/scheduler/SourceSurveyor';
import { priorityEngine } from '../engine/scheduler/PriorityEngine';

interface SchedulerStoreState {
  schedulerState: SchedulerState;
  budgetSettings: BudgetSettings;
  usage: { tokensToday: number; costThisMonth: number; dailyCap: number; monthlyCap: number; burstBudget: number };
  plan: IngestionPlan | null;
  processed: number;
  total: number;
  activities: SchedulerActivity[];
  priorityOrder: string[];
  loaded: boolean;
}

interface SchedulerStoreActions {
  load: () => Promise<void>;
  updateBudget: (patch: Partial<BudgetSettings>) => Promise<void>;
  updatePriorityOrder: (order: string[]) => Promise<void>;
  survey: (sources: ConnectedSource[]) => void;
  startScheduler: () => Promise<void>;
  pauseScheduler: () => void;
  resumeScheduler: () => Promise<void>;
  burst: (tokens: number) => void;
  refreshUsage: () => void;
}

export const useSchedulerStore = create<SchedulerStoreState & SchedulerStoreActions>((set, get) => ({
  schedulerState: 'idle',
  budgetSettings: { dailyTokenCap: 10_000, monthlyCostCap: 5.00, mode: 'conservative' },
  usage: { tokensToday: 0, costThisMonth: 0, dailyCap: 10_000, monthlyCap: 5.00, burstBudget: 0 },
  plan: null,
  processed: 0,
  total: 0,
  activities: [],
  priorityOrder: [],
  loaded: false,

  load: async () => {
    await budgetManager.load();
    const order = await priorityEngine.loadPriorityOrder();
    set({
      budgetSettings: budgetManager.getSettings(),
      usage: budgetManager.getUsage(),
      priorityOrder: order,
      loaded: true,
    });

    ingestionScheduler.setCallbacks({
      onStateChange: (state) => set({ schedulerState: state }),
      onProgress: (processed, total) => {
        set({ processed, total, usage: budgetManager.getUsage() });
      },
      onActivity: (activity) => {
        set((s) => ({ activities: [activity, ...s.activities].slice(0, 100) }));
      },
      processChunk: async (chunk) => {
        // Placeholder — actual processing is wired by the import pipeline
        return { tokensUsed: chunk.tokenEstimate, cost: budgetManager.estimateCost(chunk.tokenEstimate), itemsExtracted: 0 };
      },
    });
  },

  updateBudget: async (patch) => {
    await budgetManager.updateSettings(patch);
    set({ budgetSettings: budgetManager.getSettings(), usage: budgetManager.getUsage() });
  },

  updatePriorityOrder: async (order) => {
    await priorityEngine.savePriorityOrder(order);
    set({ priorityOrder: order });
  },

  survey: (sources) => {
    const plan = sourceSurveyor.surveyAll(sources);
    set({ plan });
  },

  startScheduler: async () => {
    await ingestionScheduler.start();
  },

  pauseScheduler: () => {
    ingestionScheduler.pause();
  },

  resumeScheduler: async () => {
    await ingestionScheduler.resume();
  },

  burst: (tokens) => {
    ingestionScheduler.burst(tokens);
    set({ usage: budgetManager.getUsage() });
  },

  refreshUsage: () => {
    set({ usage: budgetManager.getUsage() });
  },
}));
