// CloudStorageSettings.tsx — connected cloud accounts settings

import { useState, useEffect, useCallback } from 'react';
import { oauthManager } from '../../engine/import/channels/cloud/OAuthManager';
import type { OAuthProvider } from '../../engine/import/channels/cloud/OAuthManager';

interface AccountStatus {
  connected: boolean;
  email?: string;
  name?: string;
  loading: boolean;
}

const PROVIDERS: { id: OAuthProvider; label: string; icon: string; macOnly?: boolean }[] = [
  { id: 'google_drive', label: 'Google Drive', icon: '\u2601\ufe0f' },
  { id: 'dropbox', label: 'Dropbox', icon: '\ud83d\udce6' },
];

export default function CloudStorageSettings() {
  const [statuses, setStatuses] = useState<Record<string, AccountStatus>>({});
  const [isMac, setIsMac] = useState(false);
  const [icloudConnected, setIcloudConnected] = useState(false);

  useEffect(() => {
    setIsMac(navigator.userAgent.includes('Mac'));
    // Check connection statuses
    PROVIDERS.forEach(async (p) => {
      setStatuses((prev) => ({ ...prev, [p.id]: { connected: false, loading: true } }));
      const connected = await oauthManager.isConnected(p.id);
      setStatuses((prev) => ({ ...prev, [p.id]: { connected, loading: false } }));
    });
    // Check iCloud
    import('../../engine/import/channels/cloud/ICloudProvider').then(async ({ icloudProvider }) => {
      const connected = await icloudProvider.isConnected();
      setIcloudConnected(connected);
    }).catch(() => {});
  }, []);

  const handleConnect = useCallback(async (provider: OAuthProvider) => {
    setStatuses((prev) => ({ ...prev, [provider]: { ...prev[provider], loading: true } }));
    try {
      await oauthManager.startOAuth(provider);
      setStatuses((prev) => ({ ...prev, [provider]: { connected: true, loading: false } }));
    } catch (err) {
      setStatuses((prev) => ({
        ...prev,
        [provider]: { connected: false, loading: false },
      }));
    }
  }, []);

  const handleDisconnect = useCallback(async (provider: OAuthProvider) => {
    setStatuses((prev) => ({ ...prev, [provider]: { ...prev[provider], loading: true } }));
    try {
      await oauthManager.revokeTokens(provider);
    } catch { /* ignore */ }
    setStatuses((prev) => ({ ...prev, [provider]: { connected: false, loading: false } }));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Cloud Storage</h2>
        <p className="text-slate-400 text-sm mt-1">
          Connect cloud storage accounts to browse and import files.
        </p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((p) => {
          const status = statuses[p.id];
          return (
            <div key={p.id} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{p.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{p.label}</p>
                  {status?.connected && status.email && (
                    <p className="text-xs text-slate-400">{status.email}</p>
                  )}
                </div>
              </div>
              <div>
                {status?.loading ? (
                  <span className="text-xs text-slate-500">Loading...</span>
                ) : status?.connected ? (
                  <button
                    onClick={() => handleDisconnect(p.id)}
                    className="px-3 py-1.5 text-xs text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(p.id)}
                    className="px-3 py-1.5 text-xs text-indigo-400 border border-indigo-400/30 rounded-lg hover:bg-indigo-400/10 transition-colors"
                  >
                    Connect...
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* iCloud — macOS only */}
        {isMac && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg">{'\u2601\ufe0f'}</span>
              <div>
                <p className="text-sm font-medium text-white">iCloud Drive</p>
                <p className="text-xs text-slate-400">
                  {icloudConnected ? 'Connected (local access)' : 'Access via local filesystem'}
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-500">
              {icloudConnected ? 'Available' : 'Not found'}
            </span>
          </div>
        )}
      </div>

      <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-3">
        <p className="text-xs text-slate-400 leading-relaxed">
          We request read-only access. Your files are downloaded temporarily for processing and then deleted. Nothing is stored or uploaded. You can disconnect at any time.
        </p>
      </div>
    </div>
  );
}
