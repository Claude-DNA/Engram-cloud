import { chunkText } from '../ChunkManager';
import { generateUUIDv7 as generateId } from '../../../lib/uuid';
import type { ImportChunk } from '../types';

interface EngramBackupItem {
  id?: number | string;
  title?: string;
  content?: string;
  cloud_type?: string;
  date?: string;
  created_at?: string;
  tags?: string[];
}

interface EngramBackup {
  version?: number;
  persons?: unknown[];
  engram_items?: EngramBackupItem[];
  items?: EngramBackupItem[];
  [key: string]: unknown;
}

function formatItem(item: EngramBackupItem): string {
  const parts: string[] = [];
  const date = item.date ?? item.created_at;
  if (date) parts.push(`[${date.substring(0, 10)}]`);
  if (item.cloud_type) parts.push(`(${item.cloud_type})`);
  if (item.title) parts.push(item.title);
  if (item.content && item.content !== item.title) parts.push('\n' + item.content);
  if (item.tags?.length) parts.push('\nTags: ' + item.tags.join(', '));
  return parts.join(' ');
}

export async function parse(file: File, jobId: string): Promise<ImportChunk[]> {
  let backup: EngramBackup;

  try {
    const text = await file.text();
    backup = JSON.parse(text) as EngramBackup;
  } catch {
    return [];
  }

  const items: EngramBackupItem[] = backup.engram_items ?? backup.items ?? [];

  if (items.length === 0) {
    // Try treating the whole object as a single item
    if (backup.content || backup.title) {
      items.push(backup as EngramBackupItem);
    } else {
      return [];
    }
  }

  // Sort by date if available
  items.sort((a, b) => {
    const da = a.date ?? a.created_at ?? '';
    const db = b.date ?? b.created_at ?? '';
    return da.localeCompare(db);
  });

  const fullText = items.map(formatItem).join('\n\n');
  const subChunks = chunkText(fullText, jobId, false);

  return subChunks.map((c, i) => ({
    ...c,
    id: generateId(),
    index: i,
    metadata: { source: 'engram_backup', itemCount: items.length },
  }));
}
