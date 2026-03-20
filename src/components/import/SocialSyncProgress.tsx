// SocialSyncProgress.tsx — sync progress display for social accounts

import type { SyncProgress } from '../../engine/import/channels/SocialChannel';

interface Props {
  progress: SyncProgress;
  onPause: () => void;
  onResume: () => void;
}

export default function SocialSyncProgress({ progress, onPause, onResume }: Props) {
  const pct = Math.min(100, Math.round(progress.percentage));

  const platformLabel = progress.platform === 'twitter' ? 'Twitter/X'
    : progress.platform === 'instagram' ? 'Instagram' : 'YouTube';

  const formatTime = (iso: string): string => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">
          {progress.isComplete ? `${platformLabel} sync complete` : progress.isPaused ? `${platformLabel} paused` : `Syncing ${platformLabel}...`}
        </p>
        {!progress.isComplete && (
          progress.isPaused ? (
            <button onClick={onResume} className="text-xs text-indigo-400 hover:text-indigo-300">Resume</button>
          ) : (
            <button onClick={onPause} className="text-xs text-slate-400 hover:text-slate-300">Pause</button>
          )
        )}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>{progress.itemsFetched.toLocaleString()} / ~{progress.estimatedTotal.toLocaleString()} items</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${progress.isComplete ? 'bg-emerald-500' : progress.isPaused ? 'bg-amber-500' : 'bg-indigo-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {progress.rateLimitRemaining > 0 && !progress.isComplete && (
        <p className="text-xs text-slate-500">
          Rate limit: {progress.rateLimitRemaining} remaining
          {progress.rateLimitResetAt ? ` (resets ${formatTime(progress.rateLimitResetAt)})` : ''}
        </p>
      )}

      {progress.isComplete && (
        <p className="text-xs text-emerald-400">
          Fetched {progress.itemsFetched.toLocaleString()} items. Ready for processing.
        </p>
      )}
    </div>
  );
}
