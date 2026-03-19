import type { ExtractedDate } from './DateExtractor';
import type { ExtractedName } from './NameExtractor';
import type { ExtractedLocation } from './LocationExtractor';
import type { ExtractedMetadata } from './MetadataExtractor';
import type { MessageSegment } from './MessageBoundaryDetector';

export interface StructuredBlock {
  raw_text: string;
  redacted_text: string;
  redaction_map: Record<string, string>;
  dates: ExtractedDate[];
  names: ExtractedName[];
  locations: ExtractedLocation[];
  metadata: ExtractedMetadata;
  messages: MessageSegment[];
  /** JSON string ready to send to AI */
  ai_payload: string;
}

export function buildStructuredBlock(params: {
  rawText: string;
  redactedText: string;
  redactionMap: Record<string, string>;
  dates: ExtractedDate[];
  names: ExtractedName[];
  locations: ExtractedLocation[];
  metadata: ExtractedMetadata;
  messages: MessageSegment[];
}): StructuredBlock {
  const { rawText, redactedText, redactionMap, dates, names, locations, metadata, messages } = params;

  const aiPayload = {
    text: redactedText,
    detected: {
      dates: dates.map((d) => ({ text: d.text, parsed: d.parsed_date, type: d.type })),
      people: names.map((n) => ({ name: n.name, relationship: n.likely_relationship })),
      locations: locations.map((l) => ({ text: l.text, type: l.type })),
      urls: metadata.urls.map((u) => u.text),
      hashtags: metadata.hashtags.map((h) => h.text),
      message_count: messages.length > 1 ? messages.length : undefined,
    },
  };

  return {
    raw_text: rawText,
    redacted_text: redactedText,
    redaction_map: redactionMap,
    dates,
    names,
    locations,
    metadata,
    messages,
    ai_payload: JSON.stringify(aiPayload, null, 2),
  };
}
