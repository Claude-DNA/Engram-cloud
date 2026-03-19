import { useState, useCallback } from 'react';
import ImportDropZone from '../components/import/ImportDropZone';
import ImportProgress from '../components/import/ImportProgress';
import ImportPreview from '../components/import/ImportPreview';
import { routeImport } from '../engine/import/ImportRouter';
import { useImportQueue } from '../engine/import/ImportQueue';
import type { ImportSourceType } from '../engine/import/types';

// Lazy-load importers to keep the initial bundle light
async function runImporter(file: File, sourceType: ImportSourceType, jobId: string) {
  switch (sourceType) {
    case 'twitter': {
      const m = await import('../engine/import/importers/TwitterImporter');
      return m.parse(file, jobId);
    }
    case 'instagram': {
      const m = await import('../engine/import/importers/InstagramImporter');
      return m.parse(file, jobId);
    }
    case 'whatsapp': {
      const m = await import('../engine/import/importers/WhatsAppImporter');
      return m.parse(file, jobId);
    }
    case 'text': {
      const m = await import('../engine/import/importers/TextImporter');
      return m.parse(file, jobId);
    }
    case 'pdf': {
      const m = await import('../engine/import/importers/PdfImporter');
      return m.parse(file, jobId);
    }
    case 'photo': {
      const m = await import('../engine/import/importers/PhotoImporter');
      return m.parse(file, jobId);
    }
    case 'engram_backup': {
      const m = await import('../engine/import/importers/EngramBackupImporter');
      return m.parse(file, jobId);
    }
    default:
      return [];
  }
}

export default function ImportView() {
  const [detectedType, setDetectedType] = useState<ImportSourceType | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const enqueueJob = useImportQueue((s) => s.enqueueJob);
  const updateJobStatus = useImportQueue((s) => s.updateJobStatus);
  const setChunks = useImportQueue((s) => s.setChunks);
  const setPreview = useImportQueue((s) => s.setPreview);
  const appendError = useImportQueue((s) => s.appendError);
  const jobs = useImportQueue((s) => s.jobs);
  const activeJobId = useImportQueue((s) => s.activeJobId);
  const removeJob = useImportQueue((s) => s.removeJob);

  const activeJob = jobs.find((j) => j.id === activeJobId) ?? null;

  const handleFileDrop = useCallback(async (file: File) => {
    setDetecting(true);
    setCurrentFile(file);
    try {
      const sourceType = await routeImport(file);
      setDetectedType(sourceType);
    } finally {
      setDetecting(false);
    }
  }, []);

  const startImport = useCallback(
    async (mode: 'ai' | 'raw' | 'metadata') => {
      if (!currentFile || !detectedType) return;

      const jobId = enqueueJob({
        sourceType: detectedType,
        fileName: currentFile.name,
        fileSize: currentFile.size,
      });

      updateJobStatus(jobId, 'parsing', 10);

      try {
        const chunks = await runImporter(currentFile, detectedType, jobId);
        updateJobStatus(jobId, 'chunking', 40);
        setChunks(jobId, chunks);

        // Build preview stats from chunks
        setPreview(jobId, {
          estimatedChunks: chunks.length,
          detectedFormat: detectedType,
        });

        if (mode === 'ai') {
          updateJobStatus(jobId, 'ready_for_ai', 60);
          // AI processing is wired in a later area; park here for now
          updateJobStatus(jobId, 'review', 80);
        } else if (mode === 'raw') {
          updateJobStatus(jobId, 'importing', 90);
          // Raw import: chunks are ready, downstream can persist them
          updateJobStatus(jobId, 'complete', 100);
        } else {
          // Metadata only: just store the chunk metadata
          updateJobStatus(jobId, 'complete', 100);
        }
      } catch (err) {
        appendError(jobId, err instanceof Error ? err.message : String(err));
        updateJobStatus(jobId, 'error', 0);
      }
    },
    [currentFile, detectedType, enqueueJob, updateJobStatus, setChunks, setPreview, appendError],
  );

  const handleReset = () => {
    if (activeJobId) removeJob(activeJobId);
    setCurrentFile(null);
    setDetectedType(null);
  };

  const isProcessing =
    activeJob !== null &&
    !['complete', 'error', 'review'].includes(activeJob.status);

  const showPreview =
    currentFile !== null &&
    detectedType !== null &&
    detectedType !== 'unknown' &&
    activeJob === null;

  const showProgress = activeJob !== null;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Import</h1>
          <p className="text-text-secondary text-sm mt-1">
            Bring your memories in from Twitter, Instagram, WhatsApp, PDFs, photos, and more.
          </p>
        </div>

        {/* Drop zone */}
        <ImportDropZone
          onFileDrop={handleFileDrop}
          detectedType={detectedType}
          isLoading={detecting || isProcessing}
        />

        {/* Unknown type warning */}
        {detectedType === 'unknown' && !detecting && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-400 text-sm">
            Unrecognised file format. Try dropping a .zip (Twitter/Instagram), .txt (WhatsApp), .pdf, image, or .json (Engram backup).
          </div>
        )}

        {/* Preview panel */}
        {showPreview && (
          <div className="bg-surface border border-border rounded-xl p-5">
            <p className="text-text-secondary text-xs uppercase tracking-wider mb-3">File preview</p>
            <ImportPreview
              job={{
                id: '',
                sourceType: detectedType!,
                fileName: currentFile!.name,
                fileSize: currentFile!.size,
                status: 'queued',
                progress: 0,
                chunks: [],
                extractedItems: [],
                errors: [],
                createdAt: new Date().toISOString(),
              }}
              onProcessWithAI={() => startImport('ai')}
              onImportRaw={() => startImport('raw')}
              onImportMetadataOnly={() => startImport('metadata')}
            />
          </div>
        )}

        {/* Progress panel */}
        {showProgress && activeJob && (
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-text-secondary text-xs uppercase tracking-wider">Progress</p>
              {['complete', 'error'].includes(activeJob.status) && (
                <button
                  onClick={handleReset}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Import another
                </button>
              )}
            </div>

            <ImportProgress job={activeJob} />

            {/* Preview details once we have chunks */}
            {activeJob.chunks.length > 0 && (
              <ImportPreview
                job={activeJob}
                onProcessWithAI={() => {/* handled above */}}
                onImportRaw={() => {/* handled above */}}
                onImportMetadataOnly={() => {/* handled above */}}
              />
            )}
          </div>
        )}

        {/* Past jobs list */}
        {jobs.filter((j) => j.id !== activeJobId && j.status === 'complete').length > 0 && (
          <div className="space-y-2">
            <p className="text-text-secondary text-xs uppercase tracking-wider">Recent imports</p>
            {jobs
              .filter((j) => j.status === 'complete')
              .map((j) => (
                <div
                  key={j.id}
                  className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-text-primary text-sm font-medium truncate max-w-xs">{j.fileName}</p>
                    <p className="text-text-secondary text-xs">
                      {j.chunks.length} chunks · {j.sourceType}
                    </p>
                  </div>
                  <button
                    onClick={() => removeJob(j.id)}
                    className="text-text-secondary hover:text-red-400 transition-colors text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
