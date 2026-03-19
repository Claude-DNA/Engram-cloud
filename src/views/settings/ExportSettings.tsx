import { useState, useEffect } from 'react';
import { settingsRepository } from '../../repositories';
import { useEngramStore } from '../../stores/engramStore';
import { exportPersonGraph, exportCloudTypeCSV, exportMarkdown } from '../../stores/exportService';

type ExportFormat = 'json' | 'csv' | 'markdown';

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const FORMAT_OPTIONS: { value: ExportFormat; icon: string; label: string; desc: string }[] = [
  { value: 'json', icon: '📄', label: 'JSON', desc: 'Full backup — all data, restorable' },
  { value: 'csv', icon: '📊', label: 'CSV', desc: 'Spreadsheet format, all clouds' },
  { value: 'markdown', icon: '📝', label: 'Markdown', desc: 'Human-readable archive' },
];

export default function ExportSettings() {
  const activePersonId = useEngramStore((s) => s.activePersonId);
  const persons = useEngramStore((s) => s.persons);
  const activePerson = persons.find((p) => p.id === activePersonId);

  const [format, setFormat] = useState<ExportFormat>('json');
  const [status, setStatus] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  useEffect(() => {
    settingsRepository.get('export_last_date').then((v) => {
      if (v) setLastExport(v);
    }).catch(() => {});
  }, []);

  const handleExport = async () => {
    if (!activePersonId) return;
    const name = activePerson?.name?.replace(/\s+/g, '_') ?? 'export';
    const ts = Date.now();
    try {
      setStatus('Exporting...');
      if (format === 'json') {
        const data = await exportPersonGraph(activePersonId);
        downloadFile(JSON.stringify(data, null, 2), `engram_${name}_${ts}.json`, 'application/json');
      } else if (format === 'csv') {
        const csv = await exportCloudTypeCSV(activePersonId);
        downloadFile(csv, `engram_${name}_${ts}.csv`, 'text/csv');
      } else {
        const md = await exportMarkdown(activePersonId);
        downloadFile(md, `engram_${name}_${ts}.md`, 'text/markdown');
      }
      const now = new Date().toISOString();
      setLastExport(now);
      await settingsRepository.set('export_last_date', now).catch(() => {});
      setStatus('Export complete');
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Export</h2>
        <p className="text-slate-400 text-sm mt-1">Export your data in various formats.</p>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <p className="text-sm font-medium text-white mb-1">Exporting</p>
        <p className="text-sm text-slate-300">
          {activePerson ? activePerson.name : <span className="text-slate-500">No person selected</span>}
        </p>
        {lastExport && (
          <p className="text-xs text-slate-500 mt-1">
            Last export: {new Date(lastExport).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <p className="text-sm font-medium text-white mb-3">Format</p>
        <div className="space-y-2">
          {FORMAT_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="export_format"
                value={opt.value}
                checked={format === opt.value}
                onChange={() => setFormat(opt.value)}
                className="accent-amber-500"
              />
              <span className="text-base">{opt.icon}</span>
              <div>
                <p className="text-sm text-white">{opt.label}</p>
                <p className="text-xs text-slate-400">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleExport}
          disabled={!activePersonId}
          className="px-6 py-2 bg-amber-500 text-black font-medium rounded-lg text-sm hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Export All
        </button>
        {!activePersonId && (
          <p className="text-xs text-slate-500">Select a person to export their data.</p>
        )}
        {status && <p className="text-xs text-slate-400">{status}</p>}
      </div>

      <div className="border border-slate-700/30 rounded-lg p-3">
        <p className="text-xs text-slate-500">
          To export a selection of engrams, use the filter controls in the main view (coming in Phase 3).
        </p>
      </div>
    </div>
  );
}
