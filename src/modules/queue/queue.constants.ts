export const GEMINI_GENERATION_QUEUE = 'gemini-generation';

export type GeminiGenerationJobData = {
  userId: string;
  baseContract?: Record<string, unknown>;
  version?: string;
  priority?: number;
};