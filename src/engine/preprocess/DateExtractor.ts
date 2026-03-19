export interface ExtractedDate {
  text: string;
  parsed_date: string | null; // ISO 8601 string or null if unparseable
  confidence: 'high' | 'medium' | 'low';
  type: 'iso8601' | 'us' | 'eu' | 'natural' | 'relative';
  index: number; // character offset in source text
}

// ISO 8601: 2020-03-12 or 2020-03-12T14:30:00Z
const ISO_RE = /\b(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?)\b/g;

// US: 03/12/2020 or 3/12/20
const US_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;

// EU: 12.03.2020 or 12-03-2020
const EU_RE = /\b(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})\b/g;

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, oct: 10, nov: 11, dec: 12,
};

// Natural: "March 12, 2020" / "12 March 2020" / "March 2020"
const NATURAL_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b|\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\b/gi;

// Relative: yesterday, last week, last month, last year
const RELATIVE_RE = /\b(yesterday|last\s+week|last\s+month|last\s+year|today|this\s+week|this\s+month|this\s+year)\b/gi;

function zeroPad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseUSDate(m: string, d: string, y: string): string | null {
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  let year = parseInt(y, 10);
  if (year < 100) year += year < 50 ? 2000 : 1900;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${zeroPad(month)}-${zeroPad(day)}`;
}

function parseEUDate(d: string, m: string, y: string): string | null {
  return parseUSDate(m, d, y);
}

function parseNaturalDate(monthStr: string, day: string | null, year: string): string | null {
  const month = MONTHS[monthStr.toLowerCase()];
  if (!month) return null;
  const y = parseInt(year, 10);
  const d = day ? parseInt(day, 10) : 1;
  return `${y}-${zeroPad(month)}-${zeroPad(d)}`;
}

function resolveRelative(text: string, referenceDate: Date): string {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const d = new Date(referenceDate);
  if (t === 'yesterday') d.setDate(d.getDate() - 1);
  else if (t === 'last week') d.setDate(d.getDate() - 7);
  else if (t === 'last month') d.setMonth(d.getMonth() - 1);
  else if (t === 'last year') d.setFullYear(d.getFullYear() - 1);
  // today / this week / this month / this year → reference date itself
  return d.toISOString().split('T')[0];
}

export function extractDates(text: string, referenceDate: Date = new Date()): ExtractedDate[] {
  const results: ExtractedDate[] = [];
  const seen = new Set<number>();

  const add = (r: ExtractedDate) => {
    if (!seen.has(r.index)) {
      seen.add(r.index);
      results.push(r);
    }
  };

  // ISO 8601
  for (const m of text.matchAll(ISO_RE)) {
    add({
      text: m[0],
      parsed_date: m[1].substring(0, 10),
      confidence: 'high',
      type: 'iso8601',
      index: m.index ?? 0,
    });
  }

  // US
  for (const m of text.matchAll(US_RE)) {
    add({
      text: m[0],
      parsed_date: parseUSDate(m[1], m[2], m[3]),
      confidence: 'medium',
      type: 'us',
      index: m.index ?? 0,
    });
  }

  // EU
  for (const m of text.matchAll(EU_RE)) {
    add({
      text: m[0],
      parsed_date: parseEUDate(m[1], m[2], m[3]),
      confidence: 'medium',
      type: 'eu',
      index: m.index ?? 0,
    });
  }

  // Natural
  for (const m of text.matchAll(NATURAL_RE)) {
    const parsed = m[1]
      ? parseNaturalDate(m[1], m[2], m[3])
      : parseNaturalDate(m[5], m[4], m[6]);
    add({
      text: m[0],
      parsed_date: parsed,
      confidence: 'high',
      type: 'natural',
      index: m.index ?? 0,
    });
  }

  // Relative
  for (const m of text.matchAll(RELATIVE_RE)) {
    add({
      text: m[0],
      parsed_date: resolveRelative(m[0], referenceDate),
      confidence: 'low',
      type: 'relative',
      index: m.index ?? 0,
    });
  }

  return results.sort((a, b) => a.index - b.index);
}
