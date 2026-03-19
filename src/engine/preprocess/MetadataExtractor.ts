export interface ExtractedMetadata {
  urls: Array<{ text: string; index: number }>;
  emails: Array<{ text: string; index: number }>;
  phones: Array<{ text: string; index: number }>;
  hashtags: Array<{ text: string; index: number }>;
  mentions: Array<{ text: string; index: number }>;
}

const URL_RE = /https?:\/\/[^\s<>"']+/g;
const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
const PHONE_RE =
  /(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const HASHTAG_RE = /#([a-zA-Z0-9_]{1,50})\b/g;
const MENTION_RE = /@([a-zA-Z0-9_]{1,50})\b/g;

export function extractMetadata(text: string): ExtractedMetadata {
  return {
    urls: [...text.matchAll(URL_RE)].map((m) => ({ text: m[0], index: m.index ?? 0 })),
    emails: [...text.matchAll(EMAIL_RE)].map((m) => ({ text: m[0], index: m.index ?? 0 })),
    phones: [...text.matchAll(PHONE_RE)].map((m) => ({ text: m[0].trim(), index: m.index ?? 0 })),
    hashtags: [...text.matchAll(HASHTAG_RE)].map((m) => ({ text: m[1], index: m.index ?? 0 })),
    mentions: [...text.matchAll(MENTION_RE)].map((m) => ({ text: m[1], index: m.index ?? 0 })),
  };
}

/**
 * Redact PII from text before AI calls.
 * Replaces emails with [EMAIL_N] and phone numbers with [PHONE_N].
 * Returns redacted text and map from placeholder to original.
 */
export function redactPII(
  text: string,
  metadata: ExtractedMetadata,
): { text: string; map: Record<string, string> } {
  const map: Record<string, string> = {};
  let result = text;
  let emailCounter = 1;
  let phoneCounter = 1;

  const uniqueEmails = [...new Set(metadata.emails.map((e) => e.text))];
  for (const email of uniqueEmails) {
    const ph = `[EMAIL_${emailCounter++}]`;
    map[ph] = email;
    result = result.replaceAll(email, ph);
  }

  const uniquePhones = [...new Set(metadata.phones.map((p) => p.text))];
  for (const phone of uniquePhones) {
    const ph = `[PHONE_${phoneCounter++}]`;
    map[ph] = phone;
    result = result.replaceAll(phone, ph);
  }

  return { text: result, map };
}
