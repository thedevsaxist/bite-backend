import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { logger } from '../../../config/logger.js';
import { AppError } from '../../../utils/app-error.js';
import type {
  FoodRecognitionProvider,
  RecognisedItem,
  RecognitionInput,
  RecognitionResult,
} from '../food-recognition.js';
import {
  buildResponseSchema,
  buildSystemPrompt,
  buildUserText,
  type RecognitionResponse,
} from '../prompt.js';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

type AnthropicProviderOptions = {
  apiKey: string;
  model: string;
  effort: Effort;
  timeoutMs: number;
  /** Only for tests: a client to use instead of creating one. */
  client?: Pick<Anthropic, 'beta'>;
};

const aiError = (statusCode: number, code: string, message: string, cause?: unknown) => {
  const error = new AppError(statusCode, message, code);
  error.cause = cause;
  return error;
};

/**
 * Maps SDK errors to API errors (report §3.4.1 FR 20). Every failure means "try again later" to
 * the user, but the codes keep configuration problems apart from outages.
 */
function toAppError(err: unknown): AppError {
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError
  ) {
    logger.error({ err }, 'Anthropic rejected the API key');
    return aiError(503, 'AI_NOT_CONFIGURED', 'Food recognition is not set up correctly', err);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return aiError(503, 'AI_RATE_LIMITED', 'Food recognition is busy, try again shortly', err);
  }
  if (err instanceof Anthropic.BadRequestError) {
    // Our request was malformed: a bug, not something the user can fix.
    logger.error({ err }, 'Anthropic rejected the request');
    return aiError(502, 'AI_REQUEST_FAILED', 'Food recognition failed', err);
  }
  if (err instanceof Anthropic.APIError) {
    // Timeouts, network failures and 5xx responses (after the SDK's own retry).
    return aiError(503, 'AI_UNAVAILABLE', 'Food recognition is unavailable, try again later', err);
  }
  // The response couldn't be parsed against the schema.
  return aiError(502, 'AI_INVALID_RESPONSE', 'Food recognition returned an unusable answer', err);
}

const finiteOrNull = (value: number | null) =>
  value !== null && Number.isFinite(value) ? value : null;

/** Applies the ranges the schema can't express and drops anything unusable. */
export function normaliseResponse(response: RecognitionResponse): {
  items: RecognisedItem[];
  modelCalorieEstimate: number | null;
} {
  const items = response.contains_food
    ? response.items.flatMap((item): RecognisedItem[] => {
        const name = item.name.trim();
        if (!name) return [];
        const grams = finiteOrNull(item.estimated_grams);
        const confidence = finiteOrNull(item.confidence);
        return [
          {
            name,
            nutritionKey: item.nutrition_key,
            estimatedGrams: grams !== null && grams > 0 ? Math.round(grams * 10) / 10 : null,
            portionDescription: item.portion_description.trim() || null,
            confidence: confidence === null ? null : Math.min(1, Math.max(0, confidence)),
          },
        ];
      })
    : [];

  const estimate = finiteOrNull(response.meal_calorie_estimate);
  return {
    items,
    modelCalorieEstimate: estimate !== null && estimate >= 0 ? Math.round(estimate) : null,
  };
}

/** Food recognition with Claude, using structured outputs so the answer always fits the schema. */
export function createAnthropicProvider(
  options: AnthropicProviderOptions,
): FoodRecognitionProvider {
  const { model, effort } = options;
  const client =
    options.client ??
    new Anthropic({ apiKey: options.apiKey, timeout: options.timeoutMs, maxRetries: 1 });

  return {
    name: 'anthropic',

    async recognise(input: RecognitionInput): Promise<RecognitionResult> {
      let response;
      try {
        response = await client.beta.messages.parse({
          model,
          max_tokens: 16000,
          // If a safety classifier declines, retry on Anthropic's recommended fallback model.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: {
            effort,
            format: betaZodOutputFormat(buildResponseSchema(input.nutritionCatalog)),
          },
          system: [
            {
              type: 'text',
              text: buildSystemPrompt(input.nutritionCatalog),
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: input.image.mediaType,
                    data: input.image.data.toString('base64'),
                  },
                },
                { type: 'text', text: buildUserText(input) },
              ],
            },
          ],
        });
      } catch (err) {
        throw toAppError(err);
      }

      if (response.stop_reason === 'refusal') {
        logger.warn({ stopDetails: response.stop_details }, 'Food recognition was declined');
        throw aiError(422, 'AI_REFUSED', 'This photo could not be analysed');
      }
      if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
        throw aiError(502, 'AI_INVALID_RESPONSE', 'Food recognition returned an unusable answer');
      }

      return {
        ...normaliseResponse(response.parsed_output),
        raw: response.parsed_output,
        provider: 'anthropic',
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    },
  };
}
