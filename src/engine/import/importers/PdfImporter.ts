import { chunkText } from '../ChunkManager';
import { generateUUIDv7 as generateId } from '../../../lib/uuid';
import type { ImportChunk } from '../types';

/**
 * Extract text from a PDF file.
 * Uses pdf-parse (Node.js) when available, falls back to a plain-text attempt.
 * In a browser/Tauri webview context, pdf-parse requires Node.js internals —
 * callers should use this via a Tauri command if pdf-parse is unavailable.
 */
async function extractPdfText(file: File): Promise<string> {
  // Try pdf-parse (works in Node.js / Tauri sidecar context)
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = await file.arrayBuffer();
    // pdf-parse expects a Buffer; in a browser we pass the ArrayBuffer directly
    const result = await pdfParse(buffer as unknown as Buffer);
    return result.text;
  } catch {
    // Fallback: read the file as text (will be garbled for binary PDFs but
    // may recover partial text content)
    try {
      return await file.text();
    } catch {
      return '';
    }
  }
}

export async function parse(file: File, jobId: string): Promise<ImportChunk[]> {
  const text = await extractPdfText(file);
  if (!text.trim()) return [];

  const subChunks = chunkText(text, jobId, false);
  return subChunks.map((c, i) => ({
    ...c,
    id: generateId(),
    index: i,
    metadata: { source: 'pdf', fileName: file.name },
  }));
}
