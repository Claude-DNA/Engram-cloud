// Prompt templates for tag generation — Area 4.2

export function taggingSystemPrompt(): string {
  return `You are an expert at generating concise, meaningful tags for personal knowledge items.
Tags should be lowercase, 1-3 words, and capture key themes.
Return ONLY valid JSON.`;
}

export function taggingPrompt(items: Array<{ id: string; title: string; content: string; cloudType?: string }>): string {
  return `Generate relevant tags for each item. Aim for 2-5 tags per item.
Use consistent terminology across items (prefer singular nouns).

Items:
${JSON.stringify(items, null, 2)}

Return JSON array:
[
  {
    "id": "item id",
    "tags": ["tag1", "tag2", "tag3"]
  }
]`;
}
