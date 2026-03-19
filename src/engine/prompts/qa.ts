// Prompt templates for quality assurance — Area 4.2

export function qaSystemPrompt(): string {
  return `You are a final quality assurance reviewer for personal knowledge extraction.
Your job is to catch problems that earlier stages missed.
Return ONLY valid JSON.`;
}

export function qaPrompt(
  items: Array<{
    id: string;
    title: string;
    content: string;
    cloudType?: string;
    date?: string;
    confidence: number;
    tags?: string[];
  }>,
): string {
  return `Perform final QA on these extracted items. Flag any that should be:
- Rejected (empty, trivial, or meaningless content)
- Merged (near-duplicates that escaped earlier detection)
- Reclassified (obvious mis-classification)
- Title improved (unclear or too generic title)

Items:
${JSON.stringify(items, null, 2)}

Return JSON array:
[
  {
    "id": "item id",
    "action": "keep|reject|merge|reclassify|retitle",
    "mergeWithId": "other item id or null",
    "suggestedCloudType": "cloud type or null",
    "suggestedTitle": "improved title or null",
    "reason": "brief reason for action"
  }
]`;
}
