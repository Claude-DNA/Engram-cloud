import { invoke } from '@tauri-apps/api/core';
import type { AIProvider, AIResponse } from './AIProvider';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  readonly defaultModel = 'gemini-1.5-flash';

  constructor(private readonly apiKey: string) {}

  async sendPrompt(
    systemPrompt: string,
    userContent: string,
    model: string,
    temperature: number,
    maxTokens: number,
  ): Promise<AIResponse> {
    return invoke<AIResponse>('ai_send_prompt', {
      provider: 'gemini',
      apiKey: this.apiKey,
      systemPrompt,
      userContent,
      model,
      temperature,
      maxTokens,
    });
  }
}
