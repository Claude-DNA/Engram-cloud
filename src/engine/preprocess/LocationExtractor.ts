export interface ExtractedLocation {
  text: string;
  type: 'place_name' | 'address' | 'coordinates';
  lat?: number;
  lng?: number;
  index: number;
}

// Street addresses: "123 Main St", "456 Oak Avenue, Suite 7"
const ADDRESS_RE =
  /\b(\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Pl|Place|Way|Pkwy|Parkway)(?:\s*,\s*[^,\n]{1,40})?)/g;

// GPS coordinates: "40.7128, -74.0060" or "40.7128° N, 74.0060° W"
const COORDS_RE =
  /\b(-?\d{1,3}\.\d{4,})[,\s]+(-?\d{1,3}\.\d{4,})\b|(\d{1,3}\.\d+)°?\s*([NS])[,\s]+(\d{1,3}\.\d+)°?\s*([EW])/g;

// Known city/country/region patterns (capitalized, 1–3 word proper nouns after prepositions)
const PLACE_RE =
  /\b(?:in|at|near|from|to|visit(?:ed|ing)?|lived?\s+in|moved?\s+to|flew?\s+to|arrived?\s+in)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\b/g;

function parseDMS(deg: string, dir: string): number {
  const d = parseFloat(deg);
  return dir === 'S' || dir === 'W' ? -d : d;
}

export function extractLocations(text: string): ExtractedLocation[] {
  const results: ExtractedLocation[] = [];
  const seen = new Set<number>();

  const add = (r: ExtractedLocation) => {
    if (!seen.has(r.index)) {
      seen.add(r.index);
      results.push(r);
    }
  };

  for (const m of text.matchAll(ADDRESS_RE)) {
    add({ text: m[1], type: 'address', index: m.index ?? 0 });
  }

  for (const m of text.matchAll(COORDS_RE)) {
    if (m[1] && m[2]) {
      add({ text: m[0], type: 'coordinates', lat: parseFloat(m[1]), lng: parseFloat(m[2]), index: m.index ?? 0 });
    } else if (m[3] && m[4] && m[5] && m[6]) {
      add({
        text: m[0],
        type: 'coordinates',
        lat: parseDMS(m[3], m[4]),
        lng: parseDMS(m[5], m[6]),
        index: m.index ?? 0,
      });
    }
  }

  for (const m of text.matchAll(PLACE_RE)) {
    add({ text: m[1], type: 'place_name', index: m.index ?? 0 });
  }

  return results.sort((a, b) => a.index - b.index);
}

/**
 * Attach EXIF GPS coordinates as an ExtractedLocation (used by PhotoImporter).
 */
export function locationFromExif(lat: number, lng: number): ExtractedLocation {
  return {
    text: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    type: 'coordinates',
    lat,
    lng,
    index: 0,
  };
}
