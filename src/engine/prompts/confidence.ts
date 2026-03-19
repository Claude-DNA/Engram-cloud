// Prompt templates for confidence scoring — Area 4.2

export function confidenceSystemPrompt(): string {
  return `You are an expert at evaluating the quality and confidence of extracted personal knowledge items.
Return ONLY valid JSON.`;
}

export function confidencePrompt(
  items: Array<{
    id: string;
    title: string;
    content: string;
    cloudType?: string;
    date?: string;
    tags?: string[];
  }>,
): string {
  return `Assess the confidence and quality for each extracted item.

Confidence factors:
- Clarity: is the meaning clear and unambiguous?
- Specificity: is it specific enough to be meaningful?
- Completeness: is enough context present?
- Date quality: how reliable is the date?
- Classification quality: how well does it fit the cloud type?

Items:
${JSON.stringify(items, null, 2)}

Return JSON array:
[
  {
    "id": "item id",
    "confidence": 0.0-1.0,
    "qualityIssues": ["issue1", "issue2"],
    "improvementSuggestion": "optional suggestion or null"
  }
]`;
}
