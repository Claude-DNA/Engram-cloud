import { useState } from 'react';
import { useAppStore } from '../store';
import type { Theme } from '../store';
import { useEngramStore } from '../stores/engramStore';
import { settingsRepository } from '../repositories';
import { exportPersonGraph, exportCloudTypeCSV, exportMarkdown } from '../stores/exportService';
import { validateImport, importPersonGraph } from '../stores/importService';
import type { EngramExport } from '../stores/exportService';
import type { ImportResult } from '../stores/importService';
import type { CloudType } from '../types/engram';
import { VALID_CLOUD_TYPES } from '../types/engram';

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'system', label: 'System', icon: '💻' },
];

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Settings() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const activePersonId = useEngramStore((s) => s.activePersonId);
  const persons = useEngramStore((s) => s.persons);

  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const activePerson = persons.find((p) => p.id === activePersonId);

  const handleThemeChange = async (newTheme: Theme) => {
    setTheme(newTheme);
    try {
      await settingsRepository.set('theme', newTheme);
    } catch (err) {
      console.error('Failed to persist theme:', err);
    }
  };

  const handleExportJSON = async () => {
    if (!activePersonId) return;
    try {
      setExportStatus('Exporting...');
      const data = await exportPersonGraph(activePersonId);
      const json = JSON.stringify(data, null, 2);
      const name = activePerson?.name?.replace(/\s+/g, '_') ?? 'export';
      downloadFile(json, `engram_${name}_${Date.now()}.json`, 'application/json');
      setExportStatus('✅ JSON exported');
      setTimeout(() => setExportStatus(null), 3000);
    } catch (err) {
      setExportStatus(`❌ ${err instanceof Error ? err.message : 'Export failed'}`);
    }
  };

  const handleExportCSV = async (cloudType?: CloudType) => {
    if (!activePersonId) return;
    try {
      setExportStatus('Exporting CSV...');
      const csv = await exportCloudTypeCSV(activePersonId, cloudType);
      const suffix = cloudType ?? 'all';
      downloadFile(csv, `engram_${suffix}_${Date.now()}.csv`, 'text/csv');
      setExportStatus('✅ CSV exported');
      setTimeout(() => setExportStatus(null), 3000);
    } catch (err) {
      setExportStatus(`❌ ${err instanceof Error ? err.message : 'Export failed'}`);
    }
  };

  const handleExportMarkdown = async () => {
    if (!activePersonId) return;
    try {
      setExportStatus('Exporting Markdown...');
      const md = await exportMarkdown(activePersonId);
      downloadFile(md, `engram_export_${Date.now()}.md`, 'text/markdown');
      setExportStatus('✅ Markdown exported');
      setTimeout(() => setExportStatus(null), 3000);
    } catch (err) {
      setExportStatus(`❌ ${err instanceof Error ? err.message : 'Export failed'}`);
    }
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
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">⚙️ Settings</h2>

      {/* Theme */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-text-primary text-sm font-medium mb-3">Appearance</h3>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleThemeChange(opt.value)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm border transition-all ${
                theme === opt.value
                  ? 'bg-accent-gold/10 border-accent-gold text-accent-gold'
                  : 'border-border text-text-secondary hover:text-text-primary hover:border-accent-gold/30'
              }`}
            >
              <span className="block text-lg mb-1">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-text-primary text-sm font-medium mb-1">Export Data</h3>
        <p className="text-text-secondary text-xs mb-3">
          {activePerson ? `Exporting: ${activePerson.name}` : 'No person selected'}
        </p>

        <div className="space-y-2">
          <button
            onClick={handleExportJSON}
            disabled={!activePersonId}
            className="w-full text-left px-3 py-2 rounded-lg border border-border text-sm text-text-primary hover:border-accent-gold/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            📄 Export as JSON <span className="text-text-secondary text-xs">(full graph — backup/restore)</span>
          </button>
          <button
            onClick={() => handleExportCSV()}
            disabled={!activePersonId}
            className="w-full text-left px-3 py-2 rounded-lg border border-border text-sm text-text-primary hover:border-accent-gold/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            📊 Export as CSV <span className="text-text-secondary text-xs">(all clouds — spreadsheet)</span>
          </button>
          <button
            onClick={handleExportMarkdown}
            disabled={!activePersonId}
            className="w-full text-left px-3 py-2 rounded-lg border border-border text-sm text-text-primary hover:border-accent-gold/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            📝 Export as Markdown <span className="text-text-secondary text-xs">(human-readable archive)</span>
          </button>
        </div>

        {exportStatus && (
          <p className="text-text-secondary text-xs mt-2">{exportStatus}</p>
        )}
      </div>

      {/* Import */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-text-primary text-sm font-medium mb-1">Import Data</h3>
        <p className="text-text-secondary text-xs mb-3">
          Import a JSON export. Creates a new person with all their engrams.
        </p>
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-4 py-2 bg-accent-gold/10 text-accent-gold border border-accent-gold/30 rounded-lg text-sm hover:bg-accent-gold/20 transition-colors disabled:opacity-40"
        >
          {importing ? 'Importing...' : '📥 Import JSON'}
        </button>

        {importResult && (
          <div className="mt-3 text-xs space-y-1">
            {importResult.errors.length === 0 ? (
              <p className="text-emerald-400">
                ✅ Imported: {importResult.itemsCreated} engrams, {importResult.phasesCreated} phases, {importResult.transformationsCreated} transformations
              </p>
            ) : (
              <>
                <p className="text-red-400">⚠️ Errors:</p>
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

      {/* Sync placeholder */}
      <div className="bg-surface border border-border rounded-lg p-4 opacity-50">
        <h3 className="text-text-primary text-sm font-medium mb-1">☁️ Sync</h3>
        <p className="text-text-secondary text-xs">
          Cross-device sync is coming in a future update.
        </p>
        <button
          disabled
          className="mt-2 px-4 py-2 border border-border rounded-lg text-sm text-text-secondary cursor-not-allowed"
          title="Coming in Phase 6"
        >
          🔄 Sync — Coming Soon
        </button>
      </div>

      {/* App info */}
      <div className="text-text-secondary/50 text-xs space-y-1">
        <p>Engram Cloud v0.1.0</p>
        <p>Data stored locally via SQLite</p>
        <p>Your data is yours — export anytime, no lock-in.</p>
      </div>
    </div>
  );
}
