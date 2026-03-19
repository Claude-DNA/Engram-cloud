import { invoke } from '@tauri-apps/api/core';
import type { AIProvider, AIResponse } from './AIProvider';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly defaultModel = 'gpt-4o-mini';

  constructor(private readonly apiKey: string) {}

  async sendPrompt(
    systemPrompt: string,
    userContent: string,
    model: string,
    temperature: number,
    maxTokens: number,
  ): Promise<AIResponse> {
    return invoke<AIResponse>('ai_send_prompt', {
      provider: 'openai',
      apiKey: this.apiKey,
      systemPrompt,
      userContent,
      model,
      temperature,
      maxTokens,
    });
  }
}
