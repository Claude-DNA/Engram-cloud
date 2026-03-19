// Review view — Area 4.9
// Main review page for extracted engram items at /review/:jobId

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useImportStore } from '../stores/importStore';
import ReviewCard from '../components/import/ReviewCard';
import type { ExtractedEngramItem } from '../engine/import/types';
import { recordDecision } from '../engine/learning/ExtractionMemory';
import { useEngramStore } from '../stores/engramStore';

// Group items by year
function groupByYear(items: ExtractedEngramItem[]): Map<string, ExtractedEngramItem[]> {
  const groups = new Map<string, ExtractedEngramItem[]>();
  for (const item of items) {
    const year = item.date
      ? new Date(item.date).getFullYear().toString()
      : 'Unknown date';
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(item);
  }
  // Sort years descending, unknown last
  const sorted = new Map(
    [...groups.entries()].sort(([a], [b]) => {
      if (a === 'Unknown date') return 1;
      if (b === 'Unknown date') return -1;
      return Number(b) - Number(a);
    }),
  );
  return sorted;
}

export default function ReviewView() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const job = useImportStore((s) => s.getJob(jobId ?? ''));
  const updateItem = useImportStore((s) => s.updateItem);
  const acceptAllHighConfidence = useImportStore((s) => s.acceptAllHighConfidence);
  const rejectAllLowConfidence = useImportStore((s) => s.rejectAllLowConfidence);
  const personId = useEngramStore((s) => s.activePersonId);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ accepted: number; errors: number } | null>(null);

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Keyboard navigation
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!job) return;
      const items = job.items;
      const activeIdx = items.findIndex((i) => i.id === activeItemId);

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          const next = items[activeIdx + 1];
          if (next) setActiveItemId(next.id);
          break;
        }
        case 'k':
        case 'ArrowUp': {
          e.preventDefault();
          const prev = items[activeIdx - 1];
          if (prev) setActiveItemId(prev.id);
          break;
        }
        case 'a': {
          if (activeItemId) handleAccept(activeItemId);
          break;
        }
        case 'r': {
          if (activeItemId) handleReject(activeItemId);
          break;
        }
        case 'e': {
          // Edit is triggered inside ReviewCard on E key — no-op here
          break;
        }
      }
    },
    [job, activeItemId],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Scroll active card into view
  useEffect(() => {
    if (activeItemId) {
      const el = cardRefs.current.get(activeItemId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeItemId]);

  const handleAccept = (itemId: string) => {
    updateItem(jobId!, itemId, { reviewDecision: 'accept', selected: true });
  };

  const handleReject = (itemId: string) => {
    updateItem(jobId!, itemId, { reviewDecision: 'reject', selected: false });
  };

  const handleEdit = (itemId: string, patch: Partial<ExtractedEngramItem>) => {
    updateItem(jobId!, itemId, patch);
  };

  const handleImport = async () => {
    if (!job || !personId) return;
    setImporting(true);

    const acceptedItems = job.items.filter(
      (i) => i.reviewDecision === 'accept' || i.reviewDecision === 'edit',
    );

    let accepted = 0;
    let errors = 0;

    const { db } = await import('../lib/db');
    const { generateUUIDv7 } = await import('../lib/uuid');

    for (const item of acceptedItems) {
      try {
        const uuid = generateUUIDv7();
        const cloudType = item.editedCloudType ?? item.cloudType ?? 'memory';
        const title = item.editedTitle ?? item.title;
        const content = item.editedContent ?? item.content;
        const date = item.editedDate ?? item.date ?? null;

        await db.execute(
          `INSERT INTO engram_items (uuid, person_id, title, content, cloud_type, date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [uuid, personId, title, content, cloudType, date],
        );

        // Insert tags
        const tags = item.editedTags ?? item.tags ?? [];
        for (const tag of tags) {
          const tagTrimmed = tag.trim();
          if (!tagTrimmed) continue;
          await db.execute(
            `INSERT OR IGNORE INTO tags (uuid, name, created_at) VALUES (?, ?, datetime('now'))`,
            [generateUUIDv7(), tagTrimmed],
          );
          const tagRow = await db.query(
            `SELECT id FROM tags WHERE name = ? LIMIT 1`,
            [tagTrimmed],
          );
          if (tagRow[0]?.id) {
            const itemRow = await db.query(
              `SELECT id FROM engram_items WHERE uuid = ? LIMIT 1`,
              [uuid],
            );
            if (itemRow[0]?.id) {
              await db.execute(
                `INSERT OR IGNORE INTO engram_item_tags (engram_item_id, tag_id) VALUES (?, ?)`,
                [itemRow[0].id, tagRow[0].id],
              );
            }
          }
        }

        // Record decision for learning
        await recordDecision({
          itemId: item.id,
          jobId: job.id,
          decision: item.reviewDecision as 'accept' | 'edit',
          originalCloudType: item.cloudType,
          acceptedCloudType: cloudType,
          originalTitle: item.title,
          acceptedTitle: title,
          originalTags: item.tags,
          acceptedTags: tags,
        });

        accepted++;
      } catch (err) {
        console.error('[ReviewImport]', err);
        errors++;
      }
    }

    // Record rejections
    for (const item of job.items.filter((i) => i.reviewDecision === 'reject')) {
      await recordDecision({
        itemId: item.id,
        jobId: job.id,
        decision: 'reject',
        originalCloudType: item.cloudType,
        originalTitle: item.title,
      }).catch(() => {});
    }

    setImportResult({ accepted, errors });
    setImporting(false);

    // Refresh store
    const { useEngramStore: useStore } = await import('../stores/engramStore');
    const { productionLoader } = await import('../stores/storeLoader');
    await useStore.getState().hydrate(productionLoader);
  };

  if (!job) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-secondary text-sm">Job not found.</div>
      </div>
    );
  }

  if (importResult) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-slate-800/90 border border-indigo-500/20 rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h2 className="text-text-primary text-xl font-bold">Import complete</h2>
          <p className="text-text-secondary text-sm">
            {importResult.accepted} items added to your library
            {importResult.errors > 0 && ` · ${importResult.errors} errors`}
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            Go to library
          </button>
        </div>
      </div>
    );
  }

  const groupedItems = groupByYear(job.items);
  const acceptedCount = job.items.filter((i) => i.reviewDecision === 'accept' || i.reviewDecision === 'edit').length;
  const pendingCount = job.items.filter((i) => !i.reviewDecision || i.reviewDecision === 'pending').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Fixed header */}
      <div className="flex-shrink-0 border-b border-border bg-surface/80 backdrop-blur px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-text-primary text-lg font-bold">Review extraction</h1>
              <p className="text-text-secondary text-xs mt-0.5">
                {job.items.length} items · {acceptedCount} accepted · {pendingCount} pending
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => acceptAllHighConfidence(jobId!)}
                className="text-xs bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-lg px-3 py-1.5 transition-colors"
              >
                Accept high confidence
              </button>
              <button
                onClick={() => rejectAllLowConfidence(jobId!)}
                className="text-xs bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400 rounded-lg px-3 py-1.5 transition-colors"
              >
                Reject low confidence
              </button>
            </div>
          </div>

          {/* Keyboard hint */}
          <p className="text-text-secondary text-xs mt-2 opacity-60">
            J/K navigate · A accept · R reject · E edit
          </p>
        </div>
      </div>

      {/* Scrollable item list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {[...groupedItems.entries()].map(([year, items]) => (
            <section key={year}>
              <h2 className="text-text-secondary text-xs uppercase tracking-widest font-semibold mb-3 sticky top-0 bg-transparent">
                {year}
              </h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(item.id, el);
                      else cardRefs.current.delete(item.id);
                    }}
                  >
                    <ReviewCard
                      item={item}
                      isActive={activeItemId === item.id}
                      onActivate={() => setActiveItemId(item.id)}
                      onAccept={() => handleAccept(item.id)}
                      onReject={() => handleReject(item.id)}
                      onEdit={(patch) => handleEdit(item.id, patch)}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}

          {job.items.length === 0 && (
            <div className="text-center py-16 text-text-secondary text-sm">
              No items extracted from this import.
            </div>
          )}
        </div>
      </div>

      {/* Fixed footer — import action */}
      <div className="flex-shrink-0 border-t border-border bg-surface/80 backdrop-blur px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <p className="text-text-secondary text-sm">
            {acceptedCount === 0
              ? 'Accept items to import them'
              : `${acceptedCount} item${acceptedCount === 1 ? '' : 's'} ready to import`}
          </p>
          <button
            onClick={handleImport}
            disabled={acceptedCount === 0 || importing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg px-5 py-2.5 transition-colors"
          >
            {importing ? 'Importing…' : `Import ${acceptedCount} item${acceptedCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
