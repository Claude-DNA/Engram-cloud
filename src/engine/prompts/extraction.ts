// Prompt templates for item extraction — Area 4.2

export function extractionSystemPrompt(): string {
  return `You are an expert at extracting meaningful personal knowledge items from text archives.
Extract discrete engram items — memories, beliefs, knowledge, values, skills, goals, or reflections.
Each item should be self-contained and meaningful on its own.
Return ONLY valid JSON, no markdown or prose.`;
}

export function extractionPass1Prompt(structuredBlocks: string, learnedRules?: string): string {
  const rules = learnedRules ? `\n\nLearned user preferences:\n${learnedRules}` : '';
  return `Extract all meaningful engram items from the following structured content.${rules}

Content:
${structuredBlocks}

Return a JSON array of items:
[
  {
    "title": "Short descriptive title (max 80 chars)",
    "content": "Full content of the item",
    "rawDate": "Date string if found, null otherwise",
    "cloudTypeHint": "memory|knowledge|belief|value|skill|goal|reflection",
    "extractionNotes": "Brief note on why this was extracted"
  }
]`;
}

export function extractionPass2Prompt(rawItems: string, originalContext: string): string {
  return `Refine these extracted engram items for quality and completeness.
- Merge near-duplicates
- Improve titles for clarity
- Ensure content is self-contained
- Remove trivial or empty items (greetings, logistics with no meaning)

Original context excerpt:
${originalContext.slice(0, 500)}

Items to refine:
${rawItems}

Return the refined JSON array with the same structure.`;
}

export function quickExtractPrompt(structuredBlocks: string, learnedRules?: string): string {
  const rules = learnedRules ? `\n\nLearned user preferences:\n${learnedRules}` : '';
  return `Extract, classify, and date engram items from this content in one pass.${rules}

Content:
${structuredBlocks}

Return a JSON array:
[
  {
    "title": "Short descriptive title",
    "content": "Full item content",
    "cloudType": "memory|knowledge|belief|value|skill|goal|reflection",
    "date": "ISO date string or null",
    "tags": ["tag1", "tag2"],
    "confidence": 0.0-1.0
  }
]`;
}
