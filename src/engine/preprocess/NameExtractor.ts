export interface ExtractedName {
  name: string;
  context: string;
  likely_relationship: string | null;
  index: number;
}

// Relationship labels → the name that follows
const RELATIONSHIP_RE =
  /\b(my\s+(?:mother|father|dad|mom|mum|sister|brother|wife|husband|partner|friend|boss|teacher|professor|cousin|aunt|uncle|grandmother|grandfather|grandma|grandpa|son|daughter|nephew|niece|colleague|roommate|neighbor|neighbour))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;

// @username handles
const HANDLE_RE = /@([\w]{2,})/g;

// Capitalized word pairs not at the very start of a sentence (name heuristic)
// e.g. "talked to John Smith last" — we require them mid-sentence
const NAME_PAIR_RE = /(?<=[a-z,;:!?.]\s{1,3})([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})\b/g;

function extractRelationship(label: string): string {
  return label.replace(/^my\s+/i, '').trim();
}

export function extractNames(text: string): ExtractedName[] {
  const results: ExtractedName[] = [];
  const seen = new Set<string>();

  const add = (r: ExtractedName) => {
    if (!seen.has(`${r.index}:${r.name}`)) {
      seen.add(`${r.index}:${r.name}`);
      results.push(r);
    }
  };

  // Relationship-labeled names (highest confidence)
  for (const m of text.matchAll(RELATIONSHIP_RE)) {
    add({
      name: m[2],
      context: m[0],
      likely_relationship: extractRelationship(m[1]),
      index: m.index ?? 0,
    });
  }

  // @handles
  for (const m of text.matchAll(HANDLE_RE)) {
    add({
      name: `@${m[1]}`,
      context: m[0],
      likely_relationship: null,
      index: m.index ?? 0,
    });
  }

  // Capitalized pairs (lower confidence — skips sentence starts)
  for (const m of text.matchAll(NAME_PAIR_RE)) {
    const name = `${m[1]} ${m[2]}`;
    // Skip common two-word phrases that aren't names
    const skip = ['New York', 'Los Angeles', 'San Francisco', 'United States', 'North America'];
    if (!skip.includes(name)) {
      add({
        name,
        context: m[0],
        likely_relationship: null,
        index: m.index ?? 0,
      });
    }
  }

  return results.sort((a, b) => a.index - b.index);
}

/**
 * Redact names in text, replacing each unique real name with [PERSON_N].
 * Returns the redacted text and a map from placeholder to original name.
 */
export function redactNames(
  text: string,
  names: ExtractedName[],
): { text: string; map: Record<string, string> } {
  const personMap = new Map<string, string>();
  let counter = 1;
  let result = text;

  // Sort by name length descending to avoid partial replacements
  const uniqueNames = [...new Set(names.map((n) => n.name))].sort(
    (a, b) => b.length - a.length,
  );

  for (const name of uniqueNames) {
    if (name.startsWith('@')) continue; // keep handles as-is
    if (!personMap.has(name)) {
      personMap.set(name, `[PERSON_${counter++}]`);
    }
    const placeholder = personMap.get(name)!;
    result = result.replaceAll(name, placeholder);
  }

  const map: Record<string, string> = {};
  for (const [orig, ph] of personMap) {
    map[ph] = orig;
  }

  return { text: result, map };
}
