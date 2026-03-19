import { useState, useEffect } from 'react';
import { settingsRepository } from '../../repositories';
import { validateImport, importPersonGraph } from '../../stores/importService';
import type { EngramExport } from '../../stores/exportService';
import type { ImportResult } from '../../stores/importService';

interface ImportHistoryEntry {
  date: string;
  source: string;
  count: number;
}

export default function ImportSettings() {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<ImportHistoryEntry[]>([]);

  useEffect(() => {
    settingsRepository.get('import_history').then((val) => {
      if (val) {
        try {
          setHistory(JSON.parse(val));
        } catch {
          // ignore malformed
        }
      }
    }).catch(() => {});
  }, []);

  const addHistoryEntry = async (entry: ImportHistoryEntry) => {
    const next = [entry, ...history].slice(0, 5);
    setHistory(next);
    await settingsRepository.set('import_history', JSON.stringify(next)).catch(() => {});
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImporting(true);
      setImportResult(null);

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        const validation = validateImport(data);
        if (!validation.valid) {
          setImportResult({
            personsCreated: 0,
            itemsCreated: 0,
            itemsSkipped: 0,
            phasesCreated: 0,
            transformationsCreated: 0,
            errors: validation.errors,
          });
          setImporting(false);
          return;
        }

        const result = await importPersonGraph(data as EngramExport, 'merge');
        setImportResult(result);

        if (result.errors.length === 0) {
          await addHistoryEntry({
            date: new Date().toISOString(),
            source: file.name,
            count: result.itemsCreated,
          });
        }
      } catch (err) {
        setImportResult({
          personsCreated: 0,
          itemsCreated: 0,
          itemsSkipped: 0,
          phasesCreated: 0,
          transformationsCreated: 0,
          errors: [err instanceof Error ? err.message : 'Import failed'],
        });
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Import</h2>
        <p className="text-slate-400 text-sm mt-1">Bring your data in from other sources.</p>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <p className="text-sm font-medium text-white mb-3">Supported Formats</p>
        <div className="space-y-3">
          {[
            { icon: '📄', label: 'JSON', desc: 'Engram Cloud backup format — fully supported', available: true },
            { icon: '📊', label: 'CSV', desc: 'Spreadsheet import — coming in Phase 5', available: false },
            { icon: '📝', label: 'Markdown', desc: 'Structured Markdown — coming in Phase 5', available: false },
          ].map((fmt) => (
            <div key={fmt.label} className="flex items-start gap-3">
              <span className={`text-base mt-0.5 ${!fmt.available ? 'opacity-40' : ''}`}>{fmt.icon}</span>
              <div>
                <p className={`text-sm ${fmt.available ? 'text-white' : 'text-slate-500'}`}>{fmt.label}</p>
                <p className="text-xs text-slate-400">{fmt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <p className="text-sm font-medium text-white mb-1">Import Engrams</p>
        <p className="text-xs text-slate-400 mb-3">Import a JSON export. Merges with existing data, skipping duplicates.</p>
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg text-sm hover:bg-amber-400 transition-colors disabled:opacity-40"
        >
          {importing ? 'Importing...' : 'Choose File'}
        </button>

        {importResult && (
          <div className="mt-3 text-xs space-y-1">
            {importResult.errors.length === 0 ? (
              <p className="text-emerald-400">
                Imported: {importResult.itemsCreated} engrams, {importResult.phasesCreated} phases,{' '}
                {importResult.transformationsCreated} transformations
              </p>
            ) : (
              <>
                <p className="text-red-400">Import errors:</p>
                {importResult.errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-red-400/80 pl-2">· {err}</p>
                ))}
                {importResult.errors.length > 5 && (
                  <p className="text-red-400/60 pl-2">...and {importResult.errors.length - 5} more</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <p className="text-sm font-medium text-white mb-3">Recent Imports</p>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">No imports yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry, i) => (
              <div key={i} className="flex items-start justify-between text-xs border-b border-slate-700/40 last:border-0 pb-2 last:pb-0">
                <div>
                  <p className="text-slate-300 font-medium">{entry.source}</p>
                  <p className="text-slate-500 mt-0.5">
                    {new Date(entry.date).toLocaleDateString(undefined, { dateStyle: 'medium' })} · {entry.count} engrams
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
