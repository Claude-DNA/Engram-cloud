// Prompt templates for relationship mapping — Area 4.2

export function relationshipSystemPrompt(): string {
  return `You are an expert at identifying semantic relationships between personal knowledge items.
Return ONLY valid JSON.`;
}

export function relationshipPrompt(items: Array<{ id: string; title: string; content: string }>): string {
  return `Identify semantic relationships between these items.
Focus on meaningful connections: thematic overlap, causal links, or conceptual dependencies.

Items:
${JSON.stringify(items, null, 2)}

Return JSON array (empty if no strong relationships):
[
  {
    "itemAId": "item id",
    "itemBId": "item id",
    "relationshipType": "thematic|causal|conceptual|temporal|contextual",
    "strength": 0.0-1.0,
    "description": "Brief description of the relationship"
  }
]`;
}
