import { Injectable } from '@nestjs/common';
import { GeminiService } from './gemini.service';

@Injectable()
export class LlmService {
  constructor(
    private readonly geminiService: GeminiService,
  ) {}

  async generateOptimizedContract(params: {
    userId: string;
    baseContract?: Record<string, unknown>;
    version?: string;
  }): Promise<{ version: string; json: Record<string, unknown>; llmDebug?: { userPrompt: string; systemPrompt: string; rawResponse: string; request: any } }> {
    // Delegate to GeminiService which handles analytics, prompting, validation,
    // circuit breaker, and graceful fallbacks when Gemini is disabled.
    return this.geminiService.generateOptimizedContract(params);
  }
}
