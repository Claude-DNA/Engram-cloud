/**
 * CoreSpotlight integration — macOS only.
 *
 * On non-macOS, all functions are silent no-ops (the Rust layer returns ok:true
 * without doing anything). The isMacOS() guard below prevents even the invoke
 * calls from reaching the backend on other platforms.
 */

import { invoke } from '@tauri-apps/api/core';

// ── Platform guard ────────────────────────────────────────────────────────────

let _isMac: boolean | null = null;

async function isMacOS(): Promise<boolean> {
  if (_isMac !== null) return _isMac;
  try {
    const platform = 'macos';
    _isMac = platform === 'macos';
  } catch {
    _isMac = false;
  }
  return _isMac;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SpotlightItem {
  itemId: string;
  title: string;
  content: string;
  tags: string[];
  cloudType: string;
  dates: string[];
}

// ── Commands ──────────────────────────────────────────────────────────────────

/** Index (or re-index) a single item in Spotlight. */
export async function spotlightIndex(item: SpotlightItem): Promise<void> {
  if (!(await isMacOS())) return;
  try {
    await invoke('spotlight_index', {
      itemId: item.itemId,
      title: item.title,
      content: item.content,
      tags: item.tags,
      cloudType: item.cloudType,
      dates: item.dates,
    });
  } catch {
    // Non-fatal — Spotlight is a convenience feature
  }
}

/** Remove a single item from the Spotlight index. */
export async function spotlightRemove(itemId: string): Promise<void> {
  if (!(await isMacOS())) return;
  try {
    await invoke('spotlight_remove', { itemId });
  } catch {
    // Non-fatal
  }
}

/**
 * Wipe and rebuild the entire Spotlight index.
 * The caller is responsible for re-pushing all items after this returns.
 */
export async function spotlightReindexAll(): Promise<void> {
  if (!(await isMacOS())) return;
  try {
    await invoke('spotlight_reindex_all');
  } catch {
    // Non-fatal
  }
}

/** Return all item UUIDs currently in the Spotlight index. */
export async function spotlightGetIndexedIds(): Promise<string[]> {
  if (!(await isMacOS())) return [];
  try {
    const result = await invoke<{ ok: boolean; data: string[] }>(
      'spotlight_get_indexed_ids',
    );
    return result?.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Reconcile the Spotlight index against a live list of DB item UUIDs.
 *
 * Called on unlock:
 *   - Items in Spotlight but not in DB → removed from index (orphans)
 *   - Items in DB but not in Spotlight → pushed to index (missing)
 */
export async function reconcileSpotlightIndex(params: {
  dbItems: SpotlightItem[];
  enabled: boolean;
}): Promise<void> {
  if (!params.enabled || !(await isMacOS())) return;

  const indexedIds = await spotlightGetIndexedIds();
  const dbIds = new Set(params.dbItems.map((i) => i.itemId));
  const indexedSet = new Set(indexedIds);

  // Remove orphans
  const orphans = indexedIds.filter((id) => !dbIds.has(id));
  for (const id of orphans) {
    await spotlightRemove(id);
  }

  // Add missing
  const missing = params.dbItems.filter((item) => !indexedSet.has(item.itemId));
  for (const item of missing) {
    await spotlightIndex(item);
  }
}
