import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

interface FileInfo {
  path: string;
  name: string;
  file_type: string;
  extension: string;
  size_bytes: number;
  modified_at: string | null;
}

interface ScanResult {
  folderPath: string;
  totalFiles: number;
  totalSizeBytes: number;
  hitLimit: boolean;
  byType: {
    text: number;
    images: number;
    documents: number;
    archives: number;
  };
  dateRange: {
    oldest: string | null;
    newest: string | null;
  };
  files: FileInfo[];
}

interface Props {
  onFilesSelected: (files: FileInfo[], folderPath: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function FolderPickerCard({ onFilesSelected }: Props) {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleChooseFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Choose a folder to scan',
      });

      if (!selected) return; // User cancelled

      setScanning(true);
      setError('');
      setScanResult(null);
      setSelectedFiles(new Set());

      const result = await invoke<ScanResult>('folder_scan', {
        path: selected,
        maxDepth: 5,
        includeHidden: false,
        maxFiles: 10000,
      });

      setScanResult(result);
      // Select all by default
      setSelectedFiles(new Set(result.files.map((f) => f.path)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }, []);

  const toggleFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectAllOfType = useCallback(
    (type: string) => {
      if (!scanResult) return;
      const paths = scanResult.files
        .filter((f) => f.file_type === type)
        .map((f) => f.path);
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        paths.forEach((p) => next.add(p));
        return next;
      });
    },
    [scanResult],
  );

  const deselectAllOfType = useCallback(
    (type: string) => {
      if (!scanResult) return;
      const paths = new Set(
        scanResult.files.filter((f) => f.file_type === type).map((f) => f.path),
      );
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        paths.forEach((p) => next.delete(p));
        return next;
      });
    },
    [scanResult],
  );

  const handleProcess = useCallback(() => {
    if (!scanResult) return;
    const files = scanResult.files.filter((f) => selectedFiles.has(f.path));
    onFilesSelected(files, scanResult.folderPath);
  }, [scanResult, selectedFiles, onFilesSelected]);

  const filteredFiles = scanResult?.files.filter(
    (f) => !filterType || f.file_type === filterType,
  );

  const typeIcon = (t: string) => {
    switch (t) {
      case 'text': return '📝';
      case 'image': return '📷';
      case 'document': return '📄';
      case 'archive': return '📦';
      default: return '📁';
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-border rounded-xl p-4">
        <label className="text-text-secondary text-xs uppercase tracking-wider mb-3 block">
          📁 Import from Folder
        </label>

        <button
          onClick={handleChooseFolder}
          disabled={scanning}
          className="w-full py-3 border-2 border-dashed border-slate-600/50 rounded-lg text-slate-400 hover:border-indigo-500/40 hover:text-slate-300 transition-all text-sm"
        >
          {scanning ? '⏳ Scanning…' : 'Choose Folder…'}
        </button>

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {/* Scan results */}
      {scanResult && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
          <div>
            <p className="text-text-primary text-sm font-medium truncate">
              📂 {scanResult.folderPath}
            </p>
            <p className="text-text-secondary text-xs mt-1">
              Found {scanResult.totalFiles} supported files · {formatBytes(scanResult.totalSizeBytes)}
              {scanResult.hitLimit && ' (limit reached — more files may exist)'}
            </p>
            {scanResult.dateRange.oldest && (
              <p className="text-text-secondary text-xs">
                Date range: {formatDate(scanResult.dateRange.oldest)} — {formatDate(scanResult.dateRange.newest)}
              </p>
            )}
          </div>

          {/* Type breakdown */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(scanResult.byType)
              .filter(([, count]) => count > 0)
              .map(([type, count]) => (
                <button
                  key={type}
                  onClick={() => setFilterType(filterType === type ? null : type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterType === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {typeIcon(type)} {type}: {count}
                </button>
              ))}
            {filterType && (
              <button
                onClick={() => setFilterType(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
              >
                Show all
              </button>
            )}
          </div>

          {/* Batch select */}
          <div className="flex gap-2 text-xs">
            <button
              onClick={() =>
                setSelectedFiles(new Set(scanResult.files.map((f) => f.path)))
              }
              className="text-indigo-400 hover:text-indigo-300"
            >
              Select all
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setSelectedFiles(new Set())}
              className="text-slate-400 hover:text-slate-300"
            >
              Deselect all
            </button>
            {filterType && (
              <>
                <span className="text-slate-600">|</span>
                <button
                  onClick={() => selectAllOfType(filterType)}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  Select all {filterType}
                </button>
                <button
                  onClick={() => deselectAllOfType(filterType)}
                  className="text-slate-400 hover:text-slate-300"
                >
                  Deselect all {filterType}
                </button>
              </>
            )}
          </div>

          {/* File list */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredFiles?.map((file) => (
              <label
                key={file.path}
                className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-700/30 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.path)}
                  onChange={() => toggleFile(file.path)}
                  className="shrink-0 accent-amber-500"
                />
                <span className="text-sm">{typeIcon(file.file_type)}</span>
                <span className="text-text-primary text-sm truncate flex-1">
                  {file.name}
                </span>
                <span className="text-text-secondary text-xs shrink-0">
                  {formatBytes(file.size_bytes)}
                </span>
                <span className="text-text-secondary text-xs shrink-0 w-20 text-right">
                  {formatDate(file.modified_at)}
                </span>
              </label>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleProcess}
              disabled={selectedFiles.size === 0}
              className="flex-1 py-2.5 bg-amber-500/90 rounded-lg font-medium text-sm transition-all hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: '#1e1b2e' }}
            >
              Process Selected ({selectedFiles.size})
            </button>
            <button
              onClick={() => setScanResult(null)}
              className="px-4 py-2.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
