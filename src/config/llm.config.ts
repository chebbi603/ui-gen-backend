import { registerAs } from '@nestjs/config';

export default registerAs('llm', (): Record<string, any> => {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  return {
    provider,
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      baseUrl: process.env.OPENAI_BASE_URL, // optional, for proxies
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      baseUrl: process.env.ANTHROPIC_BASE_URL,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      baseUrl: process.env.GEMINI_BASE_URL,
    },
  };
});