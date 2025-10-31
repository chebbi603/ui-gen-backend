import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class GeminiClient implements OnModuleInit {
  private readonly logger = new Logger(GeminiClient.name);
  private ai?: GoogleGenAI;
  private model?: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const provider = (this.config.get<string>('llm.provider') || '').toLowerCase();
    const apiKey = this.config.get<string>('llm.gemini.apiKey');
    const model = this.config.get<string>('llm.gemini.model') || 'gemini-2.5-flash';
    const baseUrl = this.config.get<string>('llm.gemini.baseUrl');

    if (provider !== 'gemini') {
      this.logger.log('Gemini provider disabled (LLM_PROVIDER is not gemini).');
      return;
    }

    // Require API key; if missing, disable gracefully.
    const resolvedKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!resolvedKey) {
      this.logger.warn('Gemini API key missing; LLM features disabled. Set GEMINI_API_KEY.');
      return;
    }
    try {
      const opts: any = { apiKey: resolvedKey };
      if (baseUrl) opts.baseUrl = baseUrl;
      this.ai = new GoogleGenAI(opts);
      this.model = model;
      this.logger.log(`Gemini client initialized for model '${model}'${baseUrl ? ` (baseUrl=${baseUrl})` : ''}.`);
    } catch (err: any) {
      this.logger.error(`Failed to initialize Google GenAI client: ${err?.message || err}`);
    }
  }

  isEnabled(): boolean {
    return !!this.ai;
  }

  async generateText(contents: string, modelOverride?: string): Promise<string> {
    if (!this.ai) {
      throw new Error('Gemini client not initialized or disabled.');
    }
    const model = modelOverride || this.model || 'gemini-2.5-flash';
    const response = await this.ai.models.generateContent({
      model,
      contents,
    });
    return response.text ?? '';
  }
}