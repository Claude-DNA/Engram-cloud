import type { ImportChunk } from './types';
import { generateUUIDv7 as generateId } from '../../lib/uuid';

/** Hard ceiling in tokens (words × 1.3 estimate) */
const MAX_TOKENS = 4000;
/** Overlap between consecutive chunks in tokens */
const OVERLAP_TOKENS_MIN = 200;
const OVERLAP_TOKENS_MAX = 300;
/** Context carry-over header length estimate in tokens */
const CONTEXT_HEADER_TOKENS = 150;

function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

function splitIntoParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

function splitIntoSentences(paragraph: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace
  return paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
}

/**
 * Build a ~150-token summary header from the tail of the previous chunk.
 * We take the last few sentences that fit within CONTEXT_HEADER_TOKENS.
 */
function buildContextHeader(prevText: string): string {
  const sentences = splitIntoSentences(prevText);
  let header = '';
  let tokens = 0;
  // Walk sentences from the end
  for (let i = sentences.length - 1; i >= 0; i--) {
    const candidate = sentences[i] + ' ' + header;
    const est = estimateTokens(candidate);
    if (est > CONTEXT_HEADER_TOKENS) break;
    header = candidate;
    tokens = est;
    if (tokens >= CONTEXT_HEADER_TOKENS * 0.8) break;
  }
  if (!header) return '';
  return `[Context from previous section: ${header.trim()}]\n\n`;
}

/**
 * Extract an overlap tail from text — approximately OVERLAP_TOKENS_MIN..MAX tokens
 * taken from sentence boundaries.
 */
function extractOverlapTail(text: string): string {
  const sentences = splitIntoSentences(text);
  let tail = '';
  let tokens = 0;
  for (let i = sentences.length - 1; i >= 0; i--) {
    const candidate = sentences[i] + ' ' + tail;
    const est = estimateTokens(candidate);
    if (est > OVERLAP_TOKENS_MAX) break;
    tail = candidate;
    tokens = est;
    if (tokens >= OVERLAP_TOKENS_MIN) break;
  }
  return tail.trim();
}

/**
 * Split text into ImportChunk[] respecting the 4000-token ceiling,
 * paragraph/sentence boundaries, and 200–300 token overlap.
 */
export function chunkText(
  text: string,
  jobId: string,
  isThread = false,
): ImportChunk[] {
  const paragraphs = splitIntoParagraphs(text);
  const chunks: ImportChunk[] = [];
  let currentParts: string[] = [];
  let currentTokens = 0;
  let charOffset = 0;
  let chunkStartOffset = 0;
  let overlapTail = '';

  const flushChunk = () => {
    if (currentParts.length === 0) return;
    let body = currentParts.join('\n\n');
    let contextHeader = '';

    if (isThread && overlapTail) {
      contextHeader = buildContextHeader(overlapTail);
    }

    const chunkText = contextHeader + body;
    const endOffset = charOffset;

    chunks.push({
      id: generateId(),
      jobId,
      index: chunks.length,
      text: chunkText,
      contextHeader: contextHeader || undefined,
      tokenEstimate: estimateTokens(chunkText),
      startOffset: chunkStartOffset,
      endOffset,
    });

    // Prepare overlap for next chunk
    overlapTail = extractOverlapTail(body);
    chunkStartOffset = endOffset;
    currentParts = [];
    currentTokens = estimateTokens(overlapTail);

    // Seed next chunk with overlap
    if (overlapTail) {
      currentParts.push(overlapTail);
    }
  };

  for (const paragraph of paragraphs) {
    const paraTokens = estimateTokens(paragraph);
    charOffset += paragraph.length + 2; // +2 for \n\n

    if (paraTokens > MAX_TOKENS - CONTEXT_HEADER_TOKENS) {
      // Paragraph itself is too large — split at sentence level
      if (currentParts.length > 0) flushChunk();

      const sentences = splitIntoSentences(paragraph);
      for (const sentence of sentences) {
        const sentTokens = estimateTokens(sentence);
        if (currentTokens + sentTokens > MAX_TOKENS - CONTEXT_HEADER_TOKENS) {
          flushChunk();
        }
        currentParts.push(sentence);
        currentTokens += sentTokens;
      }
    } else if (currentTokens + paraTokens > MAX_TOKENS - CONTEXT_HEADER_TOKENS) {
      flushChunk();
      currentParts.push(paragraph);
      currentTokens += paraTokens;
    } else {
      currentParts.push(paragraph);
      currentTokens += paraTokens;
    }
  }

  // Flush remainder
  if (currentParts.length > 0) flushChunk();

  return chunks;
}
