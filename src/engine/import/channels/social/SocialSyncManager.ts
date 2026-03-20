// SocialSyncManager.ts — manages sync state and pagination for social accounts

import { invoke } from '@tauri-apps/api/core';
import { settingsRepository } from '../../../../repositories';

export type SyncStatus = 'idle' | 'syncing' | 'paused' | 'error';

export interface SyncState {
  platform: string;
  lastSyncAt: string;
  lastCursor: string;
  totalItemsFetched: number;
  syncStatus: SyncStatus;
  rateLimitResetAt: string | null;
  errorMessage: string | null;
}

const SYNC_KEY_PREFIX = 'social_sync_';

export class SocialSyncManager {
  private states: Map<string, SyncState> = new Map();

  async loadState(platform: string): Promise<SyncState> {
    const cached = this.states.get(platform);
    if (cached) return cached;

    try {
      const raw = await settingsRepository.get(`${SYNC_KEY_PREFIX}${platform}`);
      if (raw) {
        const state = JSON.parse(raw) as SyncState;
        this.states.set(platform, state);
        return state;
      }
    } catch {
      // ignore parse errors
    }

    const initial: SyncState = {
      platform,
      lastSyncAt: '',
      lastCursor: '',
      totalItemsFetched: 0,
      syncStatus: 'idle',
      rateLimitResetAt: null,
      errorMessage: null,
    };
    this.states.set(platform, initial);
    return initial;
  }

  async saveState(platform: string, patch: Partial<SyncState>): Promise<SyncState> {
    const current = await this.loadState(platform);
    const updated = { ...current, ...patch };
    this.states.set(platform, updated);
    await settingsRepository.set(`${SYNC_KEY_PREFIX}${platform}`, JSON.stringify(updated)).catch(() => {});
    return updated;
  }

  async markSyncing(platform: string): Promise<void> {
    await this.saveState(platform, { syncStatus: 'syncing', errorMessage: null });
  }

  async resetState(platform: string): Promise<void> {
    this.states.delete(platform);
    await settingsRepository.set(`${SYNC_KEY_PREFIX}${platform}`, '').catch(() => {});
  }

  async markComplete(platform: string, cursor: string, itemCount: number): Promise<void> {
    const current = await this.loadState(platform);
    await this.saveState(platform, {
      syncStatus: 'idle',
      lastSyncAt: new Date().toISOString(),
      lastCursor: cursor,
      totalItemsFetched: current.totalItemsFetched + itemCount,
    });
  }

  async markPaused(platform: string): Promise<void> {
    await this.saveState(platform, { syncStatus: 'paused' });
  }

  async markError(platform: string, message: string): Promise<void> {
    await this.saveState(platform, { syncStatus: 'error', errorMessage: message });
  }

  async markRateLimited(platform: string, resetAt: string): Promise<void> {
    await this.saveState(platform, { rateLimitResetAt: resetAt });
  }

  getState(platform: string): SyncState | undefined {
    return this.states.get(platform);
  }
}

export const syncManager = new SocialSyncManager();
