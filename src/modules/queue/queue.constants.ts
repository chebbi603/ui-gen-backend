export const GEMINI_GENERATION_QUEUE = 'gemini-generation';

export type GeminiGenerationJobData = {
  userId: string;
  baseContract?: Record<string, unknown>;
  version?: string;
  priority?: number;
};

export const ANALYZE_EVENTS_QUEUE = 'analyze-events';

export type AnalyzeEventsJobData = {
  userId: string;
  since?: string | Date;
  limit?: number;
  priority?: number;
};