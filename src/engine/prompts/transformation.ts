// Prompt templates for transformation detection — Area 4.2

export function transformationSystemPrompt(): string {
  return `You are an expert at detecting personal transformations — how beliefs, values, and mindsets change over time.
Transformation types: evolved_into, inspired, contradicts, supports, replaced.
Return ONLY valid JSON.`;
}

export function transformationPrompt(items: Array<{ id: string; title: string; content: string; date?: string; stateData?: unknown }>): string {
  return `Detect potential transformations between these items — where one influenced, evolved into, or contradicts another.
Only flag high-confidence relationships.

Items:
${JSON.stringify(items, null, 2)}

Return JSON array (empty array if no transformations found):
[
  {
    "sourceId": "item id",
    "targetId": "item id",
    "type": "evolved_into|inspired|contradicts|supports|replaced",
    "confidence": 0.0-1.0,
    "description": "Brief explanation of the transformation"
  }
]`;
}
