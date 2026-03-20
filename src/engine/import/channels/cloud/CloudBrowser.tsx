// CloudBrowser.tsx — cloud file browser UI

import { useState, useCallback, useEffect } from 'react';
import type { CloudFile } from './DriveProvider';
import type { CloudProviderType } from '../CloudChannel';
import { getCloudProvider } from '../CloudChannel';

interface Props {
  provider: CloudProviderType;
  onFilesSelected: (files: CloudFile[]) => void;
  onCancel: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function CloudBrowser({ provider, onFilesSelected, onCancel }: Props) {
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPath, setCurrentPath] = useState<string[]>(['root']);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const currentFolderId = currentPath[currentPath.length - 1];

  const loadFiles = useCallback(async (folderId: string) => {
    setLoading(true);
    setError('');
    try {
      const p = getCloudProvider(provider);
      const result = await p.listFiles(folderId);
      setFiles(result.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    loadFiles(currentFolderId);
  }, [currentFolderId, loadFiles]);

  const navigateToFolder = (file: CloudFile) => {
    setCurrentPath([...currentPath, file.id]);
    setSelected(new Set());
  };

  const navigateUp = () => {
    if (currentPath.length > 1) {
      setCurrentPath(currentPath.slice(0, -1));
      setSelected(new Set());
    }
  };

  const toggleSelect = (fileId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const selectedFiles = files.filter((f) => selected.has(f.id) && !f.isFolder);
  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

  const handleProcess = () => {
    onFilesSelected(selectedFiles);
  };

  const fileIcon = (f: CloudFile): string => {
    if (f.isFolder) return '\ud83d\udcc2';
    if (f.mimeType.startsWith('image/')) return '\ud83d\uddbc\ufe0f';
    if (f.mimeType.includes('pdf')) return '\ud83d\udcc4';
    if (f.mimeType.includes('document') || f.mimeType.includes('text')) return '\ud83d\udcdd';
    return '\ud83d\udcc1';
  };

  const providerLabel = provider === 'google_drive' ? 'Google Drive'
    : provider === 'dropbox' ? 'Dropbox' : 'iCloud Drive';

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-primary text-sm font-medium">
            {providerLabel}
          </p>
          <p className="text-text-secondary text-xs">
            {currentPath.length > 1 ? `/ ${currentPath.slice(1).join(' / ')}` : '/ My Drive'}
          </p>
        </div>
        {currentPath.length > 1 && (
          <button onClick={navigateUp} className="text-xs text-indigo-400 hover:text-indigo-300">
            Back
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {loading ? (
        <p className="text-text-secondary text-sm py-8 text-center">Loading...</p>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-1">
          {files.map((file) => (
            <div
              key={file.id}
              className={`flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-700/30 cursor-pointer ${
                selected.has(file.id) ? 'bg-indigo-600/10' : ''
              }`}
              onClick={() => file.isFolder ? navigateToFolder(file) : toggleSelect(file.id)}
            >
              {!file.isFolder && (
                <input
                  type="checkbox"
                  checked={selected.has(file.id)}
                  onChange={() => toggleSelect(file.id)}
                  className="shrink-0 accent-amber-500"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <span className="text-sm">{fileIcon(file)}</span>
              <span className="text-text-primary text-sm truncate flex-1">{file.name}</span>
              {file.isFolder ? (
                <span className="text-text-secondary text-xs">&rarr;</span>
              ) : (
                <span className="text-text-secondary text-xs shrink-0">{formatBytes(file.size)}</span>
              )}
            </div>
          ))}
          {files.length === 0 && (
            <p className="text-text-secondary text-sm py-4 text-center">No files found</p>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-text-secondary text-xs mb-3">
            Selected: {selectedFiles.length} files ({formatBytes(totalSize)})
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleProcess}
              className="flex-1 py-2.5 bg-amber-500/90 rounded-lg font-medium text-sm transition-all hover:bg-amber-400"
              style={{ color: '#1e1b2e' }}
            >
              Download &amp; Process Selected
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-text-secondary text-[10px] leading-tight">
        We request read-only access. Files are downloaded temporarily for processing and then deleted.
      </p>
    </div>
  );
}
