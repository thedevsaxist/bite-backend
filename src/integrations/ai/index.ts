import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import type { FoodRecognitionProvider } from './food-recognition.js';
import { createAnthropicProvider } from './providers/anthropic.js';

export type * from './food-recognition.js';

let provider: FoodRecognitionProvider | undefined;

/**
 * The configured food-recognition provider, created on first use. Throws 503 AI_NOT_CONFIGURED
 * when no API key is set, so the rest of the API keeps working without one.
 */
export function foodRecognitionProvider(): FoodRecognitionProvider {
  if (!provider) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new AppError(503, 'Food recognition is not set up yet', 'AI_NOT_CONFIGURED');
    }
    provider = createAnthropicProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.AI_MODEL,
      effort: env.AI_EFFORT,
      timeoutMs: env.AI_TIMEOUT_SECONDS * 1000,
    });
  }
  return provider;
}
