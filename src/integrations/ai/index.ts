import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import type { FoodRecognitionProvider } from './food-recognition.js';
import { createAnthropicProvider } from './providers/anthropic.js';
import { createGeminiProvider } from './providers/gemini.js';

export type * from './food-recognition.js';

const defaultModels = {
  anthropic: 'claude-opus-5-5',
  gemini: 'gemini-3.8-flash',
} as const;

let provider: FoodRecognitionProvider | undefined;

/**
 * The provider chosen by AI_PROVIDER, created on first use. Throws 503 AI_NOT_CONFIGURED when its
 * API key is missing, so the rest of the API keeps working without one.
 */
export function foodRecognitionProvider(): FoodRecognitionProvider {
  if (provider) return provider;

  const apiKey = env.AI_PROVIDER === 'gemini' ? env.GEMINI_API_KEY : env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AppError(503, 'Food recognition is not set up yet', 'AI_NOT_CONFIGURED');
  }
  const options = {
    apiKey,
    model: env.AI_MODEL ?? defaultModels[env.AI_PROVIDER],
    effort: env.AI_EFFORT,
    timeoutMs: env.AI_TIMEOUT_SECONDS * 1000,
  };
  provider =
    env.AI_PROVIDER === 'gemini' ? createGeminiProvider(options) : createAnthropicProvider(options);
  return provider;
}
