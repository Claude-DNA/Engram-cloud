// SocialAccountsSettings.tsx — connected social accounts settings UI

import { useState, useEffect, useCallback } from 'react';
import { oauthManager } from '../../engine/import/channels/cloud/OAuthManager';
import { engramItemRepository } from '../../repositories';
import { useEngramStore } from '../../stores/engramStore';
import { createPerson } from '../../stores/engramService';
import { syncManager } from '../../engine/import/channels/social/SocialSyncManager';
import { getSocialProvider, runSocialSync } from '../../engine/import/channels/SocialChannel';
import SocialSyncProgress from '../../components/import/SocialSyncProgress';
import type { SocialProfile, SyncProgress } from '../../engine/import/channels/SocialChannel';
import type { OAuthProvider } from '../../engine/import/channels/cloud/OAuthManager';
import type { SyncState } from '../../engine/import/channels/social/SocialSyncManager';

interface PlatformState {
  connected: boolean;
  loading: boolean;
  profile: SocialProfile | null;
  syncState: SyncState | null;
  syncProgress: SyncProgress | null;
}

const PLATFORMS: { id: 'twitter' | 'instagram' | 'youtube'; oauthId: OAuthProvider; label: string; icon: string }[] = [
  { id: 'twitter', oauthId: 'twitter', label: 'Twitter/X', icon: '\ud83d\udc26' },
  { id: 'instagram', oauthId: 'instagram', label: 'Instagram', icon: '\ud83d\udcf7' },
  { id: 'youtube', oauthId: 'youtube', label: 'YouTube', icon: '\u25b6\ufe0f' },
];

export default function SocialAccountsSettings() {
  const [states, setStates] = useState<Record<string, PlatformState>>({});
  const [pauseFlags, setPauseFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    PLATFORMS.forEach(async (p) => {
      setStates((prev) => ({
        ...prev,
        [p.id]: { connected: false, loading: true, profile: null, syncState: null, syncProgress: null },
      }));
      const connected = await oauthManager.isConnected(p.oauthId);
      let profile: SocialProfile | null = null;
      let syncState: SyncState | null = null;
      if (connected) {
        try { profile = await getSocialProvider(p.id).getProfile(); } catch { /* ignore */ }
        try { syncState = await syncManager.loadState(p.id); } catch { /* ignore */ }
      }
      setStates((prev) => ({
        ...prev,
        [p.id]: { connected, loading: false, profile, syncState, syncProgress: null },
      }));
    });
  }, []);

  const handleConnect = useCallback(async (platform: typeof PLATFORMS[number]) => {
    setStates((prev) => ({ ...prev, [platform.id]: { ...prev[platform.id], loading: true } }));
    try {
      await getSocialProvider(platform.id).connect();
      const profile = await getSocialProvider(platform.id).getProfile();
      setStates((prev) => ({
        ...prev,
        [platform.id]: { connected: true, loading: false, profile, syncState: null, syncProgress: null },
      }));
    } catch {
      setStates((prev) => ({
        ...prev,
        [platform.id]: { connected: false, loading: false, profile: null, syncState: null, syncProgress: null },
      }));
    }
  }, []);

  const handleDisconnect = useCallback(async (platform: typeof PLATFORMS[number]) => {
    try { await getSocialProvider(platform.id).disconnect(); } catch { /* ignore */ }
    setStates((prev) => ({
      ...prev,
      [platform.id]: { connected: false, loading: false, profile: null, syncState: null, syncProgress: null },
    }));
  }, []);

  const handleSync = useCallback(async (platform: typeof PLATFORMS[number]) => {
    setPauseFlags((prev) => ({ ...prev, [platform.id]: false }));

    runSocialSync(
      platform.id,
      {},
      (progress) => {
        setStates((prev) => ({
          ...prev,
          [platform.id]: { ...prev[platform.id], syncProgress: progress },
        }));
      },
      () => pauseFlags[platform.id] ?? false,
    ).then(async (items) => {
      // Save synced items to the engram database
      let saved = 0;
      // Ensure a person exists
      let personId = useEngramStore.getState().activePersonId;
      if (!personId) {
        const person = await createPerson({ name: 'Me' });
        useEngramStore.getState().setActivePersonId(person.id);
        personId = person.id;
      }
      const errors: string[] = [];
      for (const item of items) {
        if (!item.text || item.text.trim().length === 0) continue;
        try {
          await engramItemRepository.create({
            person_id: personId!,
            cloud_type: 'ideas',
            title: item.type === 'video'
              ? `${item.text.split('\n')[0]}`
              : `${platform.name} ${item.type} (${new Date(item.createdAt).toLocaleDateString()})`,
            content: item.text,
            date: item.createdAt || null,
          });
          saved++;
        } catch (err) {
          if (errors.length < 3) errors.push(String(err));
        }
      }
      alert(`Sync: ${saved} saved to Ideas cloud, ${errors.length} errors` + (errors.length > 0 ? '\n' + errors.slice(0,2).join('\n') : ''));
      if (saved > 0) {
        setStates((prev) => ({
          ...prev,
          [platform.id]: {
            ...prev[platform.id],
            syncProgress: prev[platform.id]?.syncProgress
              ? { ...prev[platform.id]!.syncProgress!, isComplete: true }
              : null,
          },
        }));
      }
    }).catch((err) => {
      alert('Sync failed: ' + String(err));
    });
  }, [pauseFlags]);

  const handleFullResync = useCallback(async (platform: typeof PLATFORMS[number]) => {
    // Clear sync state so it does a full fetch
    await syncManager.resetState(platform.id);
    // Then run normal sync
    handleSync(platform);
  }, [handleSync]);

  const formatDate = (iso: string): string => {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { dateStyle: 'medium' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Social Accounts</h2>
        <p className="text-slate-400 text-sm mt-1">
          Connect social accounts to import your post history.
        </p>
      </div>

      <div className="space-y-3">
        {PLATFORMS.map((p) => {
          const state = states[p.id];
          return (
            <div key={p.id} className="space-y-2">
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{p.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{p.label}</p>
                      {state?.profile && (
                        <p className="text-xs text-slate-400">
                          @{state.profile.username} &middot; {state.profile.totalItems.toLocaleString()} items
                        </p>
                      )}
                      {state?.syncState?.lastSyncAt && (
                        <p className="text-xs text-slate-500">
                          Last sync: {formatDate(state.syncState.lastSyncAt)} ({state.syncState.totalItemsFetched.toLocaleString()} fetched)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {state?.loading ? (
                      <span className="text-xs text-slate-500">Loading...</span>
                    ) : state?.connected ? (
                      <>
                        <button
                          onClick={() => handleFullResync(p)}
                          className="px-3 py-1.5 text-xs text-indigo-400 border border-indigo-400/30 rounded-lg hover:bg-indigo-400/10 transition-colors"
                        >
                          Sync Now
                        </button>
                        <button
                          onClick={() => handleDisconnect(p)}
                          className="px-3 py-1.5 text-xs text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(p)}
                        className="px-3 py-1.5 text-xs text-indigo-400 border border-indigo-400/30 rounded-lg hover:bg-indigo-400/10 transition-colors"
                      >
                        Connect...
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {state?.syncProgress && !state.syncProgress.isComplete && (
                <SocialSyncProgress
                  progress={state.syncProgress}
                  onPause={() => setPauseFlags((prev) => ({ ...prev, [p.id]: true }))}
                  onResume={() => {
                    setPauseFlags((prev) => ({ ...prev, [p.id]: false }));
                    handleSync(p);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-3">
        <p className="text-xs text-slate-400 leading-relaxed">
          Connected accounts sync your public posts. We read your posts but never post, like, follow, or modify anything on your behalf. Private or protected content is never accessed without your explicit permission. You can disconnect at any time.
        </p>
      </div>
    </div>
  );
}
