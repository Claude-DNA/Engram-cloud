import { chunkText } from '../ChunkManager';
import { generateUUIDv7 as generateId } from '../../../lib/uuid';
import type { ImportChunk } from '../types';

/** Patterns that suggest a journal / diary format */
const JOURNAL_DATE_LINE_RE = /^(?:---+\s*)?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/im;
const JOURNAL_ENTRY_SEP_RE = /^---+\s*$/m;

function isJournalFormat(text: string): boolean {
  return JOURNAL_DATE_LINE_RE.test(text);
}

/** Split journal into individual entries separated by --- or date headers */
function splitJournalEntries(text: string): string[] {
  if (JOURNAL_ENTRY_SEP_RE.test(text)) {
    return text.split(JOURNAL_ENTRY_SEP_RE).map((e) => e.trim()).filter(Boolean);
  }
  // Split on lines that look like a date header
  const entries: string[] = [];
  const lines = text.split('\n');
  let current: string[] = [];

  for (const line of lines) {
    if (JOURNAL_DATE_LINE_RE.test(line) && current.length > 0) {
      entries.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) entries.push(current.join('\n').trim());
  return entries.filter(Boolean);
}

export async function parse(file: File, jobId: string): Promise<ImportChunk[]> {
  const text = await file.text();
  const isJournal = isJournalFormat(text);

  let fullText: string;

  if (isJournal) {
    // Join entries with separators so ChunkManager respects entry boundaries
    const entries = splitJournalEntries(text);
    fullText = entries.join('\n\n---\n\n');
  } else {
    fullText = text;
  }

  const subChunks = chunkText(fullText, jobId, false);
  return subChunks.map((c, i) => ({
    ...c,
    id: generateId(),
    index: i,
    metadata: { source: 'text', isJournal },
  }));
}
