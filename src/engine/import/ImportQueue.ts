import { create } from 'zustand';
import { generateUUIDv7 as generateId } from '../../lib/uuid';
import type { ImportJob, ImportJobStatus, ImportSourceType, ImportChunk, ExtractedEngramItem } from './types';

interface ImportQueueState {
  jobs: ImportJob[];
  activeJobId: string | null;
}

interface ImportQueueActions {
  /** Create a new job and enqueue it */
  enqueueJob: (params: {
    sourceType: ImportSourceType;
    fileName: string;
    fileSize: number;
  }) => string;

  /** Update status and progress of a job */
  updateJobStatus: (id: string, status: ImportJobStatus, progress?: number) => void;

  /** Set chunks for a job */
  setChunks: (id: string, chunks: ImportChunk[]) => void;

  /** Set extracted items for a job */
  setExtractedItems: (id: string, items: ExtractedEngramItem[]) => void;

  /** Toggle selection of an extracted item */
  toggleItemSelection: (jobId: string, itemId: string) => void;

  /** Append an error to a job */
  appendError: (id: string, error: string) => void;

  /** Set preview stats */
  setPreview: (id: string, preview: ImportJob['preview']) => void;

  /** Mark job as complete */
  completeJob: (id: string) => void;

  /** Remove a job */
  removeJob: (id: string) => void;

  /** Set the active job being viewed */
  setActiveJobId: (id: string | null) => void;

  /** Get a job by id */
  getJob: (id: string) => ImportJob | undefined;
}

export type ImportQueueStore = ImportQueueState & ImportQueueActions;

export const useImportQueue = create<ImportQueueStore>((set, get) => ({
  jobs: [],
  activeJobId: null,

  enqueueJob: ({ sourceType, fileName, fileSize }) => {
    const id = generateId();
    const job: ImportJob = {
      id,
      sourceType,
      fileName,
      fileSize,
      status: 'queued',
      progress: 0,
      chunks: [],
      extractedItems: [],
      errors: [],
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ jobs: [...s.jobs, job], activeJobId: id }));
    return id;
  },

  updateJobStatus: (id, status, progress) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id
          ? { ...j, status, progress: progress !== undefined ? progress : j.progress }
          : j,
      ),
    })),

  setChunks: (id, chunks) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, chunks } : j)),
    })),

  setExtractedItems: (id, items) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, extractedItems: items } : j)),
    })),

  toggleItemSelection: (jobId, itemId) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              extractedItems: j.extractedItems.map((i) =>
                i.id === itemId ? { ...i, selected: !i.selected } : i,
              ),
            }
          : j,
      ),
    })),

  appendError: (id, error) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id ? { ...j, errors: [...j.errors, error] } : j,
      ),
    })),

  setPreview: (id, preview) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, preview } : j)),
    })),

  completeJob: (id) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id
          ? { ...j, status: 'complete', progress: 100, completedAt: new Date().toISOString() }
          : j,
      ),
    })),

  removeJob: (id) =>
    set((s) => ({
      jobs: s.jobs.filter((j) => j.id !== id),
      activeJobId: s.activeJobId === id ? null : s.activeJobId,
    })),

  setActiveJobId: (id) => set({ activeJobId: id }),

  getJob: (id) => get().jobs.find((j) => j.id === id),
}));
