// Prompt templates for PII auto-redaction — Area 4.2

export function redactionSystemPrompt(): string {
  return `You are a privacy protection assistant. Identify and redact personally identifiable information (PII) from text.
Replace each unique PII instance with a stable token like [PERSON_1], [PLACE_2], [ORG_3].
The same real-world entity should always get the same token within a document.
Return ONLY valid JSON, no markdown.`;
}

export function redactionPrompt(text: string): string {
  return `Identify and redact PII from this text. Return:
1. The redacted text with tokens
2. A mapping of tokens to PII types (NOT the actual values)

Text:
${text}

Return JSON:
{
  "redactedText": "text with [PERSON_1] style tokens",
  "tokenTypes": {
    "[PERSON_1]": "person_name",
    "[PLACE_1]": "location",
    "[ORG_1]": "organization",
    "[PHONE_1]": "phone",
    "[EMAIL_1]": "email"
  },
  "hasSensitiveContent": true|false,
  "sensitivityFlags": ["third_party_names", "health_info", "financial_info", "location_data"]
}`;
}
