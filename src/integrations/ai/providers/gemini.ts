import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';
import { logger } from '../../../config/logger.js';
import { AppError } from '../../../utils/app-error.js';
import type {
  FoodRecognitionProvider,
  RecognitionInput,
  RecognitionResult,
} from '../food-recognition.js';
import {
  buildResponseSchema,
  buildSystemPrompt,
  buildUserText,
  normaliseResponse,
  type Effort,
} from '../prompt.js';

type GeminiProviderOptions = {
  apiKey: string;
  model: string;
  effort: Effort;
  timeoutMs: number;
  /** Only for tests: a client to use instead of creating one. */
  client?: Pick<GoogleGenAI, 'models'>;
};

// Gemini's thinking levels stop at HIGH.
const thinkingLevels: Record<Effort, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
  xhigh: ThinkingLevel.HIGH,
  max: ThinkingLevel.HIGH,
};

// Finish reasons meaning Gemini's safety or policy filters stopped the answer.
const blockedFinishReasons = new Set([
  'SAFETY',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'RECITATION',
]);

const aiError = (statusCode: number, code: string, message: string, cause?: unknown) => {
  const error = new AppError(statusCode, message, code);
  error.cause = cause;
  return error;
};

const invalidResponse = (cause?: unknown) =>
  aiError(502, 'AI_INVALID_RESPONSE', 'Food recognition returned an unusable answer', cause);

/** Maps Gemini API errors to the same API errors the Claude provider uses (report §3.4.1 FR 20). */
function toAppError(err: unknown): AppError {
  if (err instanceof ApiError) {
    // Gemini answers an invalid key with 400 INVALID_ARGUMENT, and the status is all the error
    // type carries, so the message is the only way to tell it from other bad requests.
    const badKey = err.status === 400 && /api key/i.test(err.message);
    if (err.status === 401 || err.status === 403 || badKey) {
      logger.error({ err }, 'Gemini rejected the API key');
      return aiError(503, 'AI_NOT_CONFIGURED', 'Food recognition is not set up correctly', err);
    }
    if (err.status === 429) {
      return aiError(503, 'AI_RATE_LIMITED', 'Food recognition is busy, try again shortly', err);
    }
    if (err.status === 400 || err.status === 404) {
      // Our request (or model name) was wrong: a bug or a configuration problem.
      logger.error({ err }, 'Gemini rejected the request');
      return aiError(502, 'AI_REQUEST_FAILED', 'Food recognition failed', err);
    }
  }
  // 5xx responses, timeouts and network failures.
  return aiError(503, 'AI_UNAVAILABLE', 'Food recognition is unavailable, try again later', err);
}

/**
 * The response schema as plain JSON Schema for Gemini. `$schema` is dropped because Gemini only
 * accepts a subset of keywords; nullable fields come out as `anyOf [..., null]`, which it supports.
 */
export function toGeminiSchema(schema: z.ZodType) {
  const jsonSchema: Record<string, unknown> = z.toJSONSchema(schema);
  delete jsonSchema.$schema;
  return jsonSchema;
}

/**
 * Food recognition with Google Gemini, using a JSON response schema. Gemini's JSON is validated
 * against the same Zod schema as Claude's, so both providers return the same shape.
 */
export function createGeminiProvider(options: GeminiProviderOptions): FoodRecognitionProvider {
  const { model, effort } = options;
  const client =
    options.client ??
    new GoogleGenAI({
      apiKey: options.apiKey,
      httpOptions: { timeout: options.timeoutMs, retryOptions: { attempts: 2 } },
    });

  return {
    name: 'gemini',

    async recognise(input: RecognitionInput): Promise<RecognitionResult> {
      const schema = buildResponseSchema(input.nutritionCatalog);

      let response;
      try {
        response = await client.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: input.image.mediaType,
                    data: input.image.data.toString('base64'),
                  },
                },
                { text: buildUserText(input) },
              ],
            },
          ],
          config: {
            systemInstruction: buildSystemPrompt(input.nutritionCatalog),
            responseMimeType: 'application/json',
            responseJsonSchema: toGeminiSchema(schema),
            thinkingConfig: { thinkingLevel: thinkingLevels[effort] },
          },
        });
      } catch (err) {
        throw toAppError(err);
      }

      const finishReason = response.candidates?.[0]?.finishReason;
      if (
        response.promptFeedback?.blockReason ||
        (finishReason && blockedFinishReasons.has(finishReason))
      ) {
        logger.warn(
          { blockReason: response.promptFeedback?.blockReason, finishReason },
          'Food recognition was declined',
        );
        throw aiError(422, 'AI_REFUSED', 'This photo could not be analysed');
      }
      if (finishReason === 'MAX_TOKENS' || !response.text) throw invalidResponse();

      let parsed;
      try {
        parsed = schema.safeParse(JSON.parse(response.text));
      } catch (err) {
        throw invalidResponse(err);
      }
      if (!parsed.success) throw invalidResponse(parsed.error);

      const usage = response.usageMetadata;
      return {
        ...normaliseResponse(parsed.data),
        raw: parsed.data,
        provider: 'gemini',
        model: response.modelVersion ?? model,
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          // Thinking tokens are billed as output.
          outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
        },
      };
    },
  };
}
