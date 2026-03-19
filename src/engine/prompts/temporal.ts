// Prompt templates for temporal placement — Area 4.2

export function temporalSystemPrompt(): string {
  return `You are an expert at extracting and normalising dates and time references from personal content.
Return ONLY valid JSON.`;
}

export function temporalPrompt(items: Array<{ id: string; title: string; content: string; rawDate?: string }>): string {
  return `Extract or infer the most accurate date for each item.
Use context clues, relative references, and any explicit dates.
Prefer ISO 8601 format (YYYY-MM-DD or YYYY-MM or YYYY).

Items:
${JSON.stringify(items, null, 2)}

Return JSON array:
[
  {
    "id": "item id",
    "date": "ISO date string or null",
    "datePrecision": "day|month|year|decade|unknown",
    "dateSource": "explicit|inferred|contextual",
    "dateConfidence": 0.0-1.0
  }
]`;
}
