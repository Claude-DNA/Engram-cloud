// AI provider abstraction — Area 4.1

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AIResponse {
  content: string;
  usage: AIUsage;
  model: string;
  latencyMs: number;
  finishReason: string;
}

export interface AIProvider {
  /** The provider name: gemini | openai | anthropic */
  readonly name: string;
  /** The default model for this provider */
  readonly defaultModel: string;

  sendPrompt(
    systemPrompt: string,
    userContent: string,
    model: string,
    temperature: number,
    maxTokens: number,
    responseFormat?: 'text' | 'json',
  ): Promise<AIResponse>;
}
