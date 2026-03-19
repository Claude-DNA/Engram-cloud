import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { settingsRepository } from '../repositories';

interface AuthState {
  isLocked: boolean;
  lastActivity: number;
  lockTimeoutMinutes: number;
  failedAttempts: number;
  cooldownUntil: number | null;
  isFirstLaunch: boolean;
  biometricAvailable: boolean;
}

interface AuthActions {
  unlock: () => void;
  lock: () => void;
  resetActivity: () => void;
  checkTimeout: () => void;
  setFirstLaunch: (value: boolean) => void;
  setCooldownUntil: (value: number | null) => void;
  incrementFailedAttempts: () => void;
  resetFailedAttempts: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => {
  // Check idle timeout every 30s
  setInterval(() => {
    get().checkTimeout();
  }, 30_000);

  return {
    isLocked: true,
    lastActivity: Date.now(),
    lockTimeoutMinutes: 5,
    failedAttempts: 0,
    cooldownUntil: null,
    isFirstLaunch: false,
    biometricAvailable: false,

    unlock: () =>
      set({
        isLocked: false,
        lastActivity: Date.now(),
        failedAttempts: 0,
        cooldownUntil: null,
      }),

    lock: () => set({ isLocked: true }),

    resetActivity: () => set({ lastActivity: Date.now() }),

    checkTimeout: () => {
      const { isLocked, lastActivity, lockTimeoutMinutes } = get();
      if (isLocked) return;
      const idleMs = Date.now() - lastActivity;
      const timeoutMs = lockTimeoutMinutes * 60 * 1_000;
      if (idleMs >= timeoutMs) {
        set({ isLocked: true });
      }
    },

    setFirstLaunch: (value) => set({ isFirstLaunch: value }),

    setCooldownUntil: (value) => set({ cooldownUntil: value }),

    incrementFailedAttempts: () =>
      set((s) => ({ failedAttempts: s.failedAttempts + 1 })),

    resetFailedAttempts: () => set({ failedAttempts: 0 }),

    initialize: async () => {
      try {
        const hasPass = await invoke<boolean>('has_passphrase');

        // Check auth_required setting (default: true)
        let authRequired = true;
        try {
          const setting = await settingsRepository.get('auth_required');
          if (setting === 'false') authRequired = false;
        } catch {
          // DB not ready yet — default to requiring auth
        }

        // Check biometric availability
        let biometricAvailable = false;
        try {
          const bio = await invoke<{ available: boolean }>('check_biometric_availability');
          biometricAvailable = bio.available;
        } catch {
          biometricAvailable = false;
        }

        if (!hasPass) {
          set({ isFirstLaunch: true, isLocked: false, biometricAvailable });
        } else if (!authRequired) {
          set({ isFirstLaunch: false, isLocked: false, biometricAvailable });
        } else {
          set({ isFirstLaunch: false, isLocked: true, biometricAvailable });
        }
      } catch (err) {
        console.error('Auth init error:', err);
        // Treat as first launch if backend is unavailable (e.g. tests)
        set({ isFirstLaunch: true, isLocked: false });
      }
    },
  };
});
