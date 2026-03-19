import type { ImportJob } from '../../engine/import/types';

interface Props {
  job: ImportJob;
  onProcessWithAI: () => void;
  onImportRaw: () => void;
  onImportMetadataOnly: () => void;
}

export default function ImportPreview({ job, onProcessWithAI, onImportRaw, onImportMetadataOnly }: Props) {
  const { preview, fileName, fileSize, chunks } = job;

  const fileSizeLabel = fileSize < 1024 * 1024
    ? `${(fileSize / 1024).toFixed(1)} KB`
    : `${(fileSize / (1024 * 1024)).toFixed(2)} MB`;

  return (
    <div className="space-y-4">
      {/* File stats */}
      <div className="bg-surface border border-border rounded-lg p-4 space-y-2">
        <p className="text-text-primary font-medium text-sm truncate">{fileName}</p>
        <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
          <span>📦 {fileSizeLabel}</span>
          {preview?.messageCount !== undefined && (
            <span>💬 {preview.messageCount.toLocaleString()} messages</span>
          )}
          {preview?.estimatedChunks !== undefined && (
            <span>🧩 ~{preview.estimatedChunks} chunks</span>
          )}
          {chunks.length > 0 && (
            <span>🧩 {chunks.length} chunks</span>
          )}
          {preview?.detectedFormat && (
            <span>📋 {preview.detectedFormat}</span>
          )}
        </div>

        {preview?.dateRange && (
          <div className="text-xs text-text-secondary border-t border-border pt-2 mt-2">
            📅 {new Date(preview.dateRange.from).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            {' → '}
            {new Date(preview.dateRange.to).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        <button
          onClick={onProcessWithAI}
          className="w-full py-2.5 px-4 bg-accent-gold text-black font-semibold rounded-lg text-sm hover:bg-accent-gold/90 transition-colors"
        >
          ✨ Process with AI
        </button>
        <button
          onClick={onImportRaw}
          className="w-full py-2 px-4 bg-surface border border-border text-text-primary rounded-lg text-sm hover:border-accent-gold/50 transition-colors"
        >
          📝 Import as raw text
        </button>
        <button
          onClick={onImportMetadataOnly}
          className="w-full py-2 px-4 bg-surface border border-border text-text-secondary rounded-lg text-sm hover:border-accent-gold/50 transition-colors"
        >
          🗂 Import metadata only
        </button>
      </div>
    </div>
  );
}
