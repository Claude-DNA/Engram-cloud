// SchedulerDashboard.tsx — real-time ingestion progress dashboard

import { useEffect } from 'react';
import { useSchedulerStore } from '../../stores/schedulerStore';

function formatCost(cost: number): string {
  if (cost === Infinity) return 'Unlimited';
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens === Infinity) return 'Unlimited';
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return String(tokens);
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === Infinity || max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span>{pct}% of {max === Infinity ? 'unlimited' : 'budget'}</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SchedulerDashboard() {
  const {
    schedulerState, usage, plan, processed, total,
    activities, load, loaded,
    pauseScheduler, resumeScheduler, burst,
  } = useSchedulerStore();

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const totalPct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const stateLabel: Record<string, string> = {
    idle: 'Idle',
    planning: 'Planning...',
    processing: 'Processing',
    paused: 'Paused',
    budget_exhausted: 'Budget exhausted',
  };

  const stateColor: Record<string, string> = {
    idle: 'text-slate-400',
    planning: 'text-indigo-400',
    processing: 'text-emerald-400',
    paused: 'text-amber-400',
    budget_exhausted: 'text-red-400',
  };

  const formatTime = (iso: string): string => {
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Ingestion Dashboard</h2>
        <span className={`text-xs font-medium ${stateColor[schedulerState] ?? 'text-slate-400'}`}>
          {stateLabel[schedulerState] ?? schedulerState}
        </span>
      </div>

      {/* Budget overview */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Today</span>
          <span className="text-white">
            {formatTokens(usage.tokensToday)} / {formatTokens(usage.dailyCap)} tokens
          </span>
        </div>
        <ProgressBar value={usage.tokensToday} max={usage.dailyCap} color="bg-indigo-500" />

        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">This month</span>
          <span className="text-white">
            {formatCost(usage.costThisMonth)} / {formatCost(usage.monthlyCap)}
          </span>
        </div>
        <ProgressBar value={usage.costThisMonth} max={usage.monthlyCap} color="bg-amber-500" />
      </div>

      {/* Overall progress */}
      {total > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Overall progress</span>
            <span className="text-white">{processed} / {total} chunks ({totalPct}%)</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2.5">
            <div className="h-2.5 rounded-full transition-all bg-emerald-500" style={{ width: `${totalPct}%` }} />
          </div>
          {plan && (
            <p className="text-xs text-slate-500">
              Est. completion: {plan.estimatedDaysAtBudget <= 1 ? 'Today' : `~${plan.estimatedDaysAtBudget} days`} at current budget
            </p>
          )}
        </div>
      )}

      {/* Per-source progress */}
      {plan && plan.sources.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 space-y-2">
          <p className="text-sm text-slate-400 mb-2">By Source</p>
          {plan.sources.map((source) => (
            <div key={source.source} className="flex items-center gap-3">
              <span className="text-xs text-white w-24 truncate">{source.source}</span>
              <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: '0%' }} />
              </div>
              <span className="text-xs text-slate-500 w-20 text-right">
                {source.estimatedChunks} chunks
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Activity log */}
      {activities.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
          <p className="text-sm text-slate-400 mb-2">Today's Activity</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {activities.slice(0, 20).map((a, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-slate-500 shrink-0">{formatTime(a.timestamp)}</span>
                <span className="text-slate-300">{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {schedulerState === 'processing' && (
          <button
            onClick={pauseScheduler}
            className="px-4 py-2 text-xs text-amber-400 border border-amber-400/30 rounded-lg hover:bg-amber-400/10 transition-colors"
          >
            Pause
          </button>
        )}
        {(schedulerState === 'paused' || schedulerState === 'budget_exhausted') && (
          <button
            onClick={resumeScheduler}
            className="px-4 py-2 text-xs text-indigo-400 border border-indigo-400/30 rounded-lg hover:bg-indigo-400/10 transition-colors"
          >
            Resume
          </button>
        )}
        <button
          onClick={() => burst(5000)}
          className="px-4 py-2 text-xs text-emerald-400 border border-emerald-400/30 rounded-lg hover:bg-emerald-400/10 transition-colors"
        >
          Burst Mode (+5K tokens)
        </button>
      </div>
    </div>
  );
}
