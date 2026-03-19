export interface MessageSegment {
  speaker: string | null;
  timestamp: string | null;
  message: string;
  is_subject: boolean;
  index: number;
}

// WhatsApp: "12/25/2020, 3:45 PM - Name: message"
const WHATSAPP_RE =
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s+-\s+([^:]+):\s*(.*)/i;

// Email From/To/Subject headers
const EMAIL_FROM_RE = /^From:\s*(.+)/i;
const EMAIL_TO_RE = /^To:\s*(.+)/i;
const EMAIL_SUBJECT_RE = /^Subject:\s*(.+)/i;
const EMAIL_DATE_RE = /^Date:\s*(.+)/i;

// Generic chat: "[HH:MM] Name: message" or "Name (HH:MM): message"
const GENERIC_CHAT_RE_1 = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s+([^:]+):\s*(.*)/;
const GENERIC_CHAT_RE_2 = /^([A-Za-z][^(]{1,30})\s+\((\d{1,2}:\d{2})\):\s*(.*)/;

function parseWhatsApp(lines: string[]): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let current: MessageSegment | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = WHATSAPP_RE.exec(line);
    if (m) {
      if (current) segments.push(current);
      current = {
        speaker: m[3].trim(),
        timestamp: `${m[1]} ${m[2]}`.trim(),
        message: m[4],
        is_subject: false,
        index: i,
      };
    } else if (current) {
      // Continuation line
      current.message += '\n' + line;
    } else {
      // Pre-header system message
      segments.push({ speaker: null, timestamp: null, message: line, is_subject: false, index: i });
    }
  }
  if (current) segments.push(current);
  return segments;
}

function parseEmail(lines: string[]): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let from = '';
  let subject = '';
  let date = '';
  let bodyLines: string[] = [];
  let inBody = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBody) {
      const fromM = EMAIL_FROM_RE.exec(line);
      const subM = EMAIL_SUBJECT_RE.exec(line);
      const dateM = EMAIL_DATE_RE.exec(line);
      if (fromM) { from = fromM[1].trim(); continue; }
      if (subM) {
        subject = subM[1].trim();
        segments.push({ speaker: null, timestamp: null, message: subject, is_subject: true, index: i });
        continue;
      }
      if (dateM) { date = dateM[1].trim(); continue; }
      if (line.trim() === '') { inBody = true; continue; }
    } else {
      bodyLines.push(line);
    }
  }

  if (bodyLines.length > 0) {
    segments.push({
      speaker: from || null,
      timestamp: date || null,
      message: bodyLines.join('\n'),
      is_subject: false,
      index: 0,
    });
  }

  return segments;
}

function parseGenericChat(lines: string[]): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let current: MessageSegment | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m1 = GENERIC_CHAT_RE_1.exec(line);
    const m2 = GENERIC_CHAT_RE_2.exec(line);
    if (m1) {
      if (current) segments.push(current);
      current = { speaker: m1[2].trim(), timestamp: m1[1], message: m1[3], is_subject: false, index: i };
    } else if (m2) {
      if (current) segments.push(current);
      current = { speaker: m2[1].trim(), timestamp: m2[2], message: m2[3], is_subject: false, index: i };
    } else if (current) {
      current.message += '\n' + line;
    } else {
      segments.push({ speaker: null, timestamp: null, message: line, is_subject: false, index: i });
    }
  }
  if (current) segments.push(current);
  return segments;
}

type ChatFormat = 'whatsapp' | 'email' | 'generic' | 'plain';

function detectFormat(text: string): ChatFormat {
  const firstLines = text.split('\n').slice(0, 5);
  for (const line of firstLines) {
    if (WHATSAPP_RE.test(line)) return 'whatsapp';
    if (EMAIL_FROM_RE.test(line) || EMAIL_SUBJECT_RE.test(line)) return 'email';
    if (GENERIC_CHAT_RE_1.test(line) || GENERIC_CHAT_RE_2.test(line)) return 'generic';
  }
  return 'plain';
}

export function detectMessageBoundaries(text: string): MessageSegment[] {
  const lines = text.split('\n');
  const format = detectFormat(text);

  switch (format) {
    case 'whatsapp': return parseWhatsApp(lines);
    case 'email': return parseEmail(lines);
    case 'generic': return parseGenericChat(lines);
    default:
      return [{ speaker: null, timestamp: null, message: text, is_subject: false, index: 0 }];
  }
}
