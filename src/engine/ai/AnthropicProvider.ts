import { invoke } from '@tauri-apps/api/core';
import type { AIProvider, AIResponse } from './AIProvider';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly defaultModel = 'claude-sonnet-4-6';

  constructor(private readonly apiKey: string) {}

  async sendPrompt(
    systemPrompt: string,
    userContent: string,
    model: string,
    temperature: number,
    maxTokens: number,
  ): Promise<AIResponse> {
    return invoke<AIResponse>('ai_send_prompt', {
      provider: 'anthropic',
      apiKey: this.apiKey,
      systemPrompt,
      userContent,
      model,
      temperature,
      maxTokens,
    });
  }
}
