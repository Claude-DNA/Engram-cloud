// SourcePrioritySettings.tsx — source priority ordering UI

import { useEffect } from 'react';
import { useSchedulerStore } from '../../stores/schedulerStore';

const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
  text: { label: 'Personal Journal', icon: '\ud83d\udcdd' },
  whatsapp: { label: 'WhatsApp Messages', icon: '\ud83d\udcac' },
  twitter: { label: 'Twitter/X', icon: '\ud83d\udc26' },
  instagram: { label: 'Instagram', icon: '\ud83d\udcf7' },
  youtube: { label: 'YouTube', icon: '\u25b6\ufe0f' },
  google_drive: { label: 'Google Drive', icon: '\u2601\ufe0f' },
  dropbox: { label: 'Dropbox', icon: '\ud83d\udce6' },
  icloud: { label: 'iCloud Drive', icon: '\u2601\ufe0f' },
  folder: { label: 'Local Folders', icon: '\ud83d\udcc2' },
  url: { label: 'URL Imports', icon: '\ud83d\udd17' },
};

export default function SourcePrioritySettings() {
  const { priorityOrder, load, loaded, updatePriorityOrder } = useSchedulerStore();

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...priorityOrder];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    updatePriorityOrder(next);
  };

  const moveDown = (index: number) => {
    if (index >= priorityOrder.length - 1) return;
    const next = [...priorityOrder];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    updatePriorityOrder(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Source Priority</h2>
        <p className="text-slate-400 text-sm mt-1">
          Higher priority sources get processed first within your daily token budget.
        </p>
      </div>

      <div className="space-y-1">
        {priorityOrder.map((sourceId, index) => {
          const info = SOURCE_LABELS[sourceId] ?? { label: sourceId, icon: '\ud83d\udcc1' };
          return (
            <div
              key={sourceId}
              className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-3"
            >
              <span className="text-xs text-slate-500 w-5 text-right font-mono">{index + 1}.</span>
              <span className="text-sm">{info.icon}</span>
              <span className="text-sm text-white flex-1">{info.label}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-colors ${
                    index === 0
                      ? 'text-slate-600 cursor-not-allowed'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  &#9650;
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === priorityOrder.length - 1}
                  className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-colors ${
                    index === priorityOrder.length - 1
                      ? 'text-slate-600 cursor-not-allowed'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  &#9660;
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-3">
        <p className="text-xs text-slate-400 leading-relaxed">
          The scheduler processes the highest-priority sources first. Within each source, newer content is processed before older content.
        </p>
      </div>
    </div>
  );
}
