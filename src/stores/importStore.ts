// Processing store — Area 4.8
// Zustand store for AI import processing: jobs, progress, cost tracking.

import { create } from 'zustand';
import type { ImportJob, ExtractedEngramItem } from '../engine/import/types';

export type ProcessingJobStatus =
  | 'queued'
  | 'processing'
  | 'paused'
  | 'review'
  | 'importing'
  | 'complete'
  | 'error';

export interface ProcessingJob {
  id: string;
  importJobId: string;
  fileName: string;
  totalChunks: number;
  processedChunks: number;
  status: ProcessingJobStatus;
  /** Items extracted so far */
  items: ExtractedEngramItem[];
  errors: string[];
  createdAt: string;
  completedAt?: string;
}

interface ImportStoreState {
  jobs: ProcessingJob[];
  activeJobId: string | null;
  isProcessing: boolean;
  isPaused: boolean;
  sessionTokensUsed: number;
  sessionEstimatedCost: number;
}

interface ImportStoreActions {
  createJob: (params: {
    importJobId: string;
    fileName: string;
    totalChunks: number;
  }) => string;

  updateJob: (id: string, patch: Partial<ProcessingJob>) => void;
  appendItems: (id: string, items: ExtractedEngramItem[]) => void;
  appendError: (id: string, error: string) => void;

  setProcessing: (processing: boolean) => void;
  setPaused: (paused: boolean) => void;

  recordTokenUsage: (inputTokens: number, outputTokens: number, cost: number) => void;

  updateItem: (jobId: string, itemId: string, patch: Partial<ExtractedEngramItem>) => void;
  toggleItemSelection: (jobId: string, itemId: string) => void;

  acceptAllHighConfidence: (jobId: string, threshold?: number) => void;
  rejectAllLowConfidence: (jobId: string, threshold?: number) => void;

  setActiveJobId: (id: string | null) => void;
  getJob: (id: string) => ProcessingJob | undefined;

  resetSession: () => void;
  removeJob: (id: string) => void;
}

export type ImportStore = ImportStoreState & ImportStoreActions;

let _idCounter = 0;
const nextId = () => `pjob_${Date.now()}_${++_idCounter}`;

export const useImportStore = create<ImportStore>((set, get) => ({
  jobs: [],
  activeJobId: null,
  isProcessing: false,
  isPaused: false,
  sessionTokensUsed: 0,
  sessionEstimatedCost: 0,

  createJob: ({ importJobId, fileName, totalChunks }) => {
    const id = nextId();
    const job: ProcessingJob = {
      id,
      importJobId,
      fileName,
      totalChunks,
      processedChunks: 0,
      status: 'queued',
      items: [],
      errors: [],
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ jobs: [...s.jobs, job], activeJobId: id }));
    return id;
  },

  updateJob: (id, patch) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    })),

  appendItems: (id, items) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id ? { ...j, items: [...j.items, ...items] } : j,
      ),
    })),

  appendError: (id, error) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id ? { ...j, errors: [...j.errors, error] } : j,
      ),
    })),

  setProcessing: (isProcessing) => set({ isProcessing }),
  setPaused: (isPaused) => set({ isPaused }),

  recordTokenUsage: (inputTokens, outputTokens, cost) =>
    set((s) => ({
      sessionTokensUsed: s.sessionTokensUsed + inputTokens + outputTokens,
      sessionEstimatedCost: s.sessionEstimatedCost + cost,
    })),

  updateItem: (jobId, itemId, patch) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              items: j.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
            }
          : j,
      ),
    })),

  toggleItemSelection: (jobId, itemId) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              items: j.items.map((i) =>
                i.id === itemId ? { ...i, selected: !i.selected } : i,
              ),
            }
          : j,
      ),
    })),

  acceptAllHighConfidence: (jobId, threshold = 0.8) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              items: j.items.map((i) =>
                i.confidence >= threshold
                  ? { ...i, selected: true, reviewDecision: 'accept' as const }
                  : i,
              ),
            }
          : j,
      ),
    })),

  rejectAllLowConfidence: (jobId, threshold = 0.5) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              items: j.items.map((i) =>
                i.confidence < threshold
                  ? { ...i, selected: false, reviewDecision: 'reject' as const }
                  : i,
              ),
            }
          : j,
      ),
    })),

  setActiveJobId: (id) => set({ activeJobId: id }),
  getJob: (id) => get().jobs.find((j) => j.id === id),

  resetSession: () =>
    set({ sessionTokensUsed: 0, sessionEstimatedCost: 0, isProcessing: false, isPaused: false }),

  removeJob: (id) =>
    set((s) => ({
      jobs: s.jobs.filter((j) => j.id !== id),
      activeJobId: s.activeJobId === id ? null : s.activeJobId,
    })),
}));

/** Run AI extraction on a set of chunks with progress tracking */
export async function runAIProcessing(
  importJob: ImportJob,
  processingJobId: string,
  opts: {
    provider: import('../engine/ai/AIProvider').AIProvider;
    model: string;
    governor: import('../engine/ai/CostGovernor').CostGovernor;
    quickMode: boolean;
  },
): Promise<void> {
  const store = useImportStore.getState();
  const { ExtractionPipeline } = await import('../engine/extraction/ExtractionPipeline');

  const pipeline = new ExtractionPipeline({
    quickMode: opts.quickMode,
    provider: opts.provider,
    model: opts.model,
    governor: opts.governor,
    onProgress: (stage, _pct) => {
      console.debug(`[Pipeline] ${stage}`);
    },
  });

  store.setProcessing(true);
  store.updateJob(processingJobId, { status: 'processing' });

  for (let i = 0; i < importJob.chunks.length; i++) {
    // Re-read paused state on each iteration
    if (useImportStore.getState().isPaused) {
      await waitUntilResumed();
    }

    const chunk = importJob.chunks[i];
    try {
      const result = await pipeline.process(chunk);
      store.appendItems(processingJobId, result.items);
      store.updateJob(processingJobId, { processedChunks: i + 1 });

      // Sync cost to store
      const snap = opts.governor.getSnapshot();
      store.recordTokenUsage(0, 0, 0); // Just update the cost from governor
      useImportStore.setState({
        sessionTokensUsed: snap.sessionInputTokens + snap.sessionOutputTokens,
        sessionEstimatedCost: snap.sessionCost,
      });
    } catch (err) {
      store.appendError(processingJobId, err instanceof Error ? err.message : String(err));
    }

    // 500ms delay between chunks
    if (i < importJob.chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  store.updateJob(processingJobId, {
    status: 'review',
    completedAt: new Date().toISOString(),
  });
  store.setProcessing(false);
}

function waitUntilResumed(): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (!useImportStore.getState().isPaused) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
  });
}
