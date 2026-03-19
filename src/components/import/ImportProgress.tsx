import type { ImportJob, ImportJobStatus } from '../../engine/import/types';

const STATUS_LABELS: Record<ImportJobStatus, string> = {
  queued: 'Queued',
  parsing: 'Parsing file…',
  chunking: 'Splitting into chunks…',
  ready_for_ai: 'Ready for AI processing',
  processing: 'Processing with AI…',
  review: 'Ready for review',
  importing: 'Importing engrams…',
  complete: 'Import complete',
  error: 'Error',
};

const STATUS_COLORS: Record<ImportJobStatus, string> = {
  queued: 'text-text-secondary',
  parsing: 'text-accent-gold',
  chunking: 'text-accent-gold',
  ready_for_ai: 'text-blue-400',
  processing: 'text-purple-400',
  review: 'text-emerald-400',
  importing: 'text-accent-gold',
  complete: 'text-emerald-400',
  error: 'text-red-400',
};

interface Props {
  job: ImportJob;
}

export default function ImportProgress({ job }: Props) {
  const isActive = !['complete', 'error'].includes(job.status);

  return (
    <div className="space-y-3">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${STATUS_COLORS[job.status]}`}>
          {STATUS_LABELS[job.status]}
        </span>
        <span className="text-text-secondary text-sm">{job.progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-background rounded-full overflow-hidden border border-border">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            job.status === 'error'
              ? 'bg-red-500'
              : job.status === 'complete'
              ? 'bg-emerald-500'
              : 'bg-accent-gold'
          } ${isActive && job.progress < 100 ? 'animate-pulse' : ''}`}
          style={{ width: `${job.progress}%` }}
        />
      </div>

      {/* Chunk info */}
      {job.chunks.length > 0 && (
        <p className="text-text-secondary text-xs">
          {job.chunks.length} chunk{job.chunks.length !== 1 ? 's' : ''} · ~
          {job.chunks.reduce((s, c) => s + c.tokenEstimate, 0).toLocaleString()} tokens
        </p>
      )}

      {/* Errors */}
      {job.errors.length > 0 && (
        <div className="mt-2 space-y-1">
          {job.errors.slice(0, 3).map((err, i) => (
            <p key={i} className="text-red-400 text-xs">· {err}</p>
          ))}
          {job.errors.length > 3 && (
            <p className="text-red-400/60 text-xs">…and {job.errors.length - 3} more</p>
          )}
        </div>
      )}
    </div>
  );
}
