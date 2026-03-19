// Prompt templates for state extraction — Area 4.2

export function stateSystemPrompt(): string {
  return `You are an expert at extracting psychological and belief state data from personal content.
State data captures the person's internal state: emotions, certainty, commitments, and intensity.
Return ONLY valid JSON.`;
}

export function statePrompt(items: Array<{ id: string; title: string; content: string }>): string {
  return `Extract state data for each item — the emotional/psychological state it represents.

Items:
${JSON.stringify(items, null, 2)}

Return JSON array:
[
  {
    "id": "item id",
    "stateData": {
      "emotion": "primary emotion if any (joy, sadness, fear, anger, surprise, disgust, anticipation, trust)",
      "emotionIntensity": 0.0-1.0,
      "certainty": 0.0-1.0,
      "commitment": 0.0-1.0,
      "valence": -1.0 to 1.0,
      "themes": ["theme1", "theme2"]
    }
  }
]`;
}
