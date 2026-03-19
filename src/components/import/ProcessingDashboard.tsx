// Processing dashboard — Area 4.8
import { useImportStore } from '../../stores/importStore';

interface Props {
  jobId: string;
  onViewReview: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

const CLOUD_ICONS: Record<string, string> = {
  memory: '💭', knowledge: '📚', belief: '🧭', value: '⭐',
  skill: '🛠', goal: '🎯', reflection: '🪞',
};

export default function ProcessingDashboard({ jobId, onViewReview, onPause, onResume, onCancel }: Props) {
  const job = useImportStore((s) => s.getJob(jobId));
  const isProcessing = useImportStore((s) => s.isProcessing);
  const isPaused = useImportStore((s) => s.isPaused);
  const sessionTokensUsed = useImportStore((s) => s.sessionTokensUsed);
  const sessionEstimatedCost = useImportStore((s) => s.sessionEstimatedCost);

  if (!job) return null;

  const progress = job.totalChunks > 0
    ? Math.round((job.processedChunks / job.totalChunks) * 100)
    : 0;

  // Count items by cloud type
  const cloudCounts: Record<string, number> = {};
  for (const item of job.items) {
    const ct = item.cloudType ?? 'unknown';
    cloudCounts[ct] = (cloudCounts[ct] ?? 0) + 1;
  }

  const isComplete = job.status === 'review' || job.status === 'complete';
  const hasErrors = job.errors.length > 0;

  return (
    <div className="bg-slate-800/90 border border-indigo-500/20 rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-text-primary font-semibold truncate max-w-xs">{job.fileName}</h3>
          <p className="text-text-secondary text-xs mt-0.5">
            {job.processedChunks} / {job.totalChunks} chunks · {job.items.length} items extracted
          </p>
        </div>
        <StatusBadge status={job.status} isPaused={isPaused} />
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isComplete ? 'bg-emerald-500' : isPaused ? 'bg-amber-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${isComplete ? 100 : progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-text-secondary">
          <span>{isComplete ? 'Complete' : isPaused ? 'Paused' : `Processing…`}</span>
          <span>{isComplete ? '100' : progress}%</span>
        </div>
      </div>

      {/* Cloud type breakdown */}
      {Object.keys(cloudCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(cloudCounts).map(([ct, count]) => (
            <div
              key={ct}
              className="flex items-center gap-1.5 bg-slate-700/60 border border-indigo-500/10 rounded-lg px-2.5 py-1"
            >
              <span className="text-sm">{CLOUD_ICONS[ct] ?? '•'}</span>
              <span className="text-text-primary text-xs font-medium">{count}</span>
              <span className="text-text-secondary text-xs capitalize">{ct}</span>
            </div>
          ))}
        </div>
      )}

      {/* Token / cost tracking */}
      <div className="flex gap-4 text-xs text-text-secondary border-t border-slate-700 pt-3">
        <span>
          Tokens: <span className="text-text-primary font-medium">{sessionTokensUsed.toLocaleString()}</span>
        </span>
        <span>
          Est. cost: <span className="text-amber-400 font-medium">${sessionEstimatedCost.toFixed(4)}</span>
        </span>
      </div>

      {/* Errors */}
      {hasErrors && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-1">
          <p className="text-red-400 text-xs font-medium">{job.errors.length} error(s)</p>
          {job.errors.slice(-2).map((e, i) => (
            <p key={i} className="text-red-300 text-xs truncate">{e}</p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {isComplete ? (
          <button
            onClick={onViewReview}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            Review {job.items.length} items
          </button>
        ) : (
          <>
            {isProcessing && !isPaused && (
              <button
                onClick={onPause}
                className="flex-1 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 text-sm font-medium rounded-lg px-4 py-2 transition-colors"
              >
                Pause
              </button>
            )}
            {isPaused && (
              <button
                onClick={onResume}
                className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-sm font-medium rounded-lg px-4 py-2 transition-colors"
              >
                Resume
              </button>
            )}
            <button
              onClick={onCancel}
              className="bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400 text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, isPaused }: { status: string; isPaused: boolean }) {
  if (isPaused) {
    return <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-0.5">Paused</span>;
  }
  switch (status) {
    case 'processing':
      return <span className="text-xs bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 rounded-full px-2.5 py-0.5 animate-pulse">Processing</span>;
    case 'review':
    case 'complete':
      return <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-0.5">Ready</span>;
    case 'error':
      return <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/20 rounded-full px-2.5 py-0.5">Error</span>;
    default:
      return <span className="text-xs bg-slate-600/50 text-text-secondary border border-slate-600 rounded-full px-2.5 py-0.5">Queued</span>;
  }
}
