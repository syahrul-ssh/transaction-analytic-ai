import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.AI_MODEL ?? 'gpt-5',
  maxOutputTokens: Number(
    process.env.AI_MAX_OUTPUT_TOKENS ?? 3000,
  ),
  timeoutMs: Number(
    process.env.AI_TIMEOUT_MS ?? 60000,
  ),
}));