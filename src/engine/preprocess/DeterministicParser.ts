import { extractDates } from './DateExtractor';
import { extractNames, redactNames } from './NameExtractor';
import { extractLocations } from './LocationExtractor';
import { extractMetadata, redactPII } from './MetadataExtractor';
import { detectMessageBoundaries } from './MessageBoundaryDetector';
import { buildStructuredBlock, type StructuredBlock } from './StructuredBlockBuilder';
import type { ImportChunk } from '../import/types';

export type { StructuredBlock };

/**
 * Run all deterministic extractors on a chunk of text and return a StructuredBlock.
 * Level-1 redaction (names, emails, phones) is applied BEFORE the block is assembled,
 * so the ai_payload field is already redacted and safe to send to any AI service.
 */
export function parseChunk(chunk: ImportChunk, referenceDate?: Date): StructuredBlock {
  const rawText = chunk.text;

  // 1. Extract metadata first (before redaction so we have the originals)
  const metadata = extractMetadata(rawText);

  // 2. Extract names on the raw text
  const names = extractNames(rawText);

  // 3. Apply Level-1 redaction: names → [PERSON_N], emails → [EMAIL_N], phones → [PHONE_N]
  const { text: afterNameRedact, map: nameMap } = redactNames(rawText, names);
  const { text: redactedText, map: piiMap } = redactPII(afterNameRedact, metadata);
  const redactionMap = { ...nameMap, ...piiMap };

  // 4. Run remaining extractors on redacted text
  const dates = extractDates(redactedText, referenceDate);
  const locations = extractLocations(redactedText);
  const messages = detectMessageBoundaries(redactedText);

  return buildStructuredBlock({
    rawText,
    redactedText,
    redactionMap,
    dates,
    names,
    locations,
    metadata,
    messages,
  });
}

/**
 * Parse all chunks from an import job.
 */
export function parseChunks(chunks: ImportChunk[], referenceDate?: Date): StructuredBlock[] {
  return chunks.map((c) => parseChunk(c, referenceDate));
}
