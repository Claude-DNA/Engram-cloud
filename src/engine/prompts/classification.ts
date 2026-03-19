// Prompt templates for cloud type classification — Area 4.2

export function classificationSystemPrompt(): string {
  return `You are an expert at classifying personal knowledge items into cloud types.
Cloud types:
- memory: episodic events and experiences from the past
- knowledge: facts, information, and things learned
- belief: convictions, opinions, and worldviews
- value: core values, principles, and what matters most
- skill: capabilities, abilities, and expertise
- goal: aspirations, objectives, and future intentions
- reflection: insights, self-observations, and meta-cognition

Return ONLY valid JSON.`;
}

export function classificationPrompt(items: Array<{ id: string; title: string; content: string }>): string {
  return `Classify each item into the most appropriate cloud type.

Items:
${JSON.stringify(items, null, 2)}

Return JSON array:
[
  {
    "id": "item id",
    "cloudType": "memory|knowledge|belief|value|skill|goal|reflection",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation"
  }
]`;
}
