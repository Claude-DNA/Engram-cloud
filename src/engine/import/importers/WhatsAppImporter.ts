import { chunkText } from '../ChunkManager';
import { generateUUIDv7 as generateId } from '../../../lib/uuid';
import type { ImportChunk } from '../types';

interface WhatsAppMessage {
  timestamp: Date;
  speaker: string;
  message: string;
}

// Supported date formats in WhatsApp exports
const DATE_PATTERNS = [
  // DD/MM/YYYY, HH:MM - Name: ...
  /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?\s+-\s+([^:]+):\s*(.*)/,
  // MM/DD/YYYY, HH:MM - Name: ...
  /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})\s+([AaPp][Mm])\s+-\s+([^:]+):\s*(.*)/,
  // YYYY-MM-DD HH:MM - Name: ...
  /^(\d{4})-(\d{2})-(\d{2}),?\s+(\d{2}):(\d{2})\s+-\s+([^:]+):\s*(.*)/,
];

/** Try all date patterns and return a parsed message or null. */
function parseLine(line: string): Omit<WhatsAppMessage, 'timestamp'> & { rawDate: string } | null {
  for (const re of DATE_PATTERNS) {
    const m = re.exec(line);
    if (m) {
      // Best-effort: extract speaker and message from last two captures
      const groups = m.slice(1).filter(Boolean);
      const speaker = groups[groups.length - 2] ?? 'Unknown';
      const message = groups[groups.length - 1] ?? '';
      return { rawDate: m[0].split('-')[0].trim(), speaker: speaker.trim(), message };
    }
  }
  return null;
}

function autoDetectFormat(firstLine: string): 'eu' | 'us' | 'iso' {
  if (/^\d{4}-/.test(firstLine)) return 'iso';
  // Heuristic: if first number >12 it must be day-first (EU)
  const match = /^(\d{1,2})\/(\d{1,2})/.exec(firstLine);
  if (match && parseInt(match[1], 10) > 12) return 'eu';
  return 'us';
}

function parseTimestamp(rawDate: string, _format: 'eu' | 'us' | 'iso'): Date {
  // Raw date is in the format part of the match — approximate with Date constructor
  return new Date(rawDate) || new Date();
}

/** Group messages within 30-minute windows into conversation exchanges */
function groupExchanges(messages: WhatsAppMessage[]): WhatsAppMessage[][] {
  const exchanges: WhatsAppMessage[][] = [];
  let current: WhatsAppMessage[] = [];
  const WINDOW_MS = 30 * 60 * 1000;

  for (const msg of messages) {
    if (current.length === 0) {
      current.push(msg);
    } else {
      const lastTs = current[current.length - 1].timestamp.getTime();
      if (msg.timestamp.getTime() - lastTs <= WINDOW_MS) {
        current.push(msg);
      } else {
        exchanges.push(current);
        current = [msg];
      }
    }
  }
  if (current.length > 0) exchanges.push(current);
  return exchanges;
}

function formatExchange(msgs: WhatsAppMessage[]): string {
  return msgs
    .map((m) => {
      const ts = m.timestamp.toISOString().replace('T', ' ').substring(0, 16);
      return `[${ts}] ${m.speaker}: ${m.message}`;
    })
    .join('\n');
}

export async function parse(file: File, jobId: string): Promise<ImportChunk[]> {
  const text = await file.text();
  const lines = text.split('\n');

  const format = autoDetectFormat(lines[0] ?? '');
  const messages: WhatsAppMessage[] = [];
  let current: (Omit<WhatsAppMessage, 'timestamp'> & { rawDate: string }) | null = null;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) {
      if (current) {
        messages.push({
          ...current,
          timestamp: parseTimestamp(current.rawDate, format),
        });
      }
      current = parsed;
    } else if (current) {
      // Continuation of previous message
      current.message += '\n' + line;
    }
  }
  if (current) {
    messages.push({ ...current, timestamp: parseTimestamp(current.rawDate, format) });
  }

  const exchanges = groupExchanges(messages);
  const fullText = exchanges.map(formatExchange).join('\n\n---\n\n');

  const subChunks = chunkText(fullText, jobId, true);
  return subChunks.map((c, i) => ({
    ...c,
    id: generateId(),
    index: i,
    metadata: { source: 'whatsapp', messageCount: messages.length },
  }));
}
