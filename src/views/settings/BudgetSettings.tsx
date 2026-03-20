// BudgetSettings.tsx — budget configuration UI

import { useEffect, useState } from 'react';
import { useSchedulerStore } from '../../stores/schedulerStore';
import type { BudgetSettings as BudgetSettingsType } from '../../engine/scheduler/BudgetManager';

const MODES: { id: BudgetSettingsType['mode']; label: string; desc: string }[] = [
  { id: 'conservative', label: 'Conservative', desc: '$5/month, 10K tokens/day' },
  { id: 'balanced', label: 'Balanced', desc: '$15/month, 30K tokens/day' },
  { id: 'unlimited', label: 'Unlimited', desc: 'No caps (can be expensive)' },
  { id: 'custom', label: 'Custom', desc: 'Set your own limits' },
];

export default function BudgetSettings() {
  const { budgetSettings, usage, plan, load, loaded, updateBudget, refreshUsage } = useSchedulerStore();
  const [customDaily, setCustomDaily] = useState('');
  const [customMonthly, setCustomMonthly] = useState('');

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(() => {
    if (budgetSettings.mode === 'custom') {
      setCustomDaily(String(budgetSettings.dailyTokenCap));
      setCustomMonthly(String(budgetSettings.monthlyCostCap));
    }
  }, [budgetSettings]);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  const handleModeChange = async (mode: BudgetSettingsType['mode']) => {
    if (mode === 'custom') {
      await updateBudget({ mode });
    } else {
      await updateBudget({ mode });
    }
  };

  const handleCustomApply = async () => {
    const daily = parseInt(customDaily);
    const monthly = parseFloat(customMonthly);
    if (!isNaN(daily) && daily > 0 && !isNaN(monthly) && monthly > 0) {
      await updateBudget({ mode: 'custom', dailyTokenCap: daily, monthlyCostCap: monthly });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Ingestion Budget</h2>
        <p className="text-slate-400 text-sm mt-1">
          Control how fast your sources are processed.
        </p>
      </div>

      {/* Mode selector */}
      <div className="space-y-2">
        {MODES.map((mode) => (
          <label
            key={mode.id}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              budgetSettings.mode === mode.id
                ? 'border-indigo-500/50 bg-indigo-600/10'
                : 'border-slate-700/50 bg-slate-800/40 hover:bg-slate-800/60'
            }`}
          >
            <input
              type="radio"
              name="budget-mode"
              checked={budgetSettings.mode === mode.id}
              onChange={() => handleModeChange(mode.id)}
              className="accent-indigo-500"
            />
            <div>
              <p className="text-sm font-medium text-white">{mode.label}</p>
              <p className="text-xs text-slate-400">{mode.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Custom inputs */}
      {budgetSettings.mode === 'custom' && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Daily token cap</label>
            <input
              type="number"
              value={customDaily}
              onChange={(e) => setCustomDaily(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              placeholder="10000"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Monthly cost cap ($)</label>
            <input
              type="number"
              step="0.50"
              value={customMonthly}
              onChange={(e) => setCustomMonthly(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              placeholder="5.00"
            />
          </div>
          <button
            onClick={handleCustomApply}
            className="w-full py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors"
          >
            Apply
          </button>
        </div>
      )}

      {/* Current usage */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-white">Current Usage</p>
        <div className="flex justify-between text-xs text-slate-400">
          <span>Today</span>
          <span>{usage.tokensToday.toLocaleString()} / {usage.dailyCap === Infinity ? 'Unlimited' : usage.dailyCap.toLocaleString()} tokens</span>
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>This month</span>
          <span>${usage.costThisMonth.toFixed(2)} / {usage.monthlyCap === Infinity ? 'Unlimited' : `$${usage.monthlyCap.toFixed(2)}`}</span>
        </div>
        {usage.burstBudget > 0 && (
          <div className="flex justify-between text-xs text-emerald-400">
            <span>Burst bonus</span>
            <span>+{usage.burstBudget.toLocaleString()} tokens</span>
          </div>
        )}
      </div>

      {/* Estimated completion */}
      {plan && (
        <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            Estimated completion at this budget:{' '}
            <span className="text-white">
              {plan.estimatedDaysAtBudget <= 1
                ? 'Today'
                : `~${plan.estimatedDaysAtBudget} days (~${plan.estimatedMonthsAtBudget} month${plan.estimatedMonthsAtBudget !== 1 ? 's' : ''})`}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
