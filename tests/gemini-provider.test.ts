import { ApiError } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogFood } from '../src/integrations/ai/food-recognition.js';
import type { RecognitionResponse } from '../src/integrations/ai/prompt.js';
import { createGeminiProvider } from '../src/integrations/ai/providers/gemini.js';

const catalog: CatalogFood[] = [
  { key: 'jollof_rice', name: 'Jollof rice', aliases: ['jollof'] },
  { key: 'fried_plantain', name: 'Fried plantain', aliases: ['dodo'] },
];
const image = { data: Buffer.from('jpeg bytes'), mediaType: 'image/jpeg' as const };

const answer: RecognitionResponse = {
  contains_food: true,
  items: [
    {
      name: 'jollof rice',
      nutrition_key: 'jollof_rice',
      estimated_grams: 320,
      portion_description: '1 plate',
      confidence: 0.9,
    },
    {
      name: 'zobo drink',
      nutrition_key: null,
      estimated_grams: 300,
      portion_description: '1 glass',
      confidence: 1.3,
    },
  ],
  meal_calorie_estimate: 640,
};

/** A Gemini response as the SDK returns it (only the fields the provider reads). */
const geminiResponse = (overrides: Record<string, unknown> = {}) => ({
  text: JSON.stringify(answer),
  candidates: [{ finishReason: 'STOP' }],
  modelVersion: 'gemini-3.8-flash-001',
  usageMetadata: { promptTokenCount: 1800, candidatesTokenCount: 300, thoughtsTokenCount: 500 },
  ...overrides,
});

function providerWith(result: Promise<unknown>, effort: 'low' | 'medium' | 'max' = 'medium') {
  const generateContent = vi.fn(() => result);
  const provider = createGeminiProvider({
    apiKey: 'gemini-test-key',
    model: 'gemini-3.8-flash',
    effort,
    timeoutMs: 90_000,
    client: { models: { generateContent } } as never,
  });
  return { provider, generateContent };
}

const recognise = (result: Promise<unknown>) =>
  providerWith(result).provider.recognise({ image, context: 'Lunch', nutritionCatalog: catalog });

describe('Gemini provider', () => {
  it('sends the photo, notes, catalog and JSON schema', async () => {
    const { provider, generateContent } = providerWith(Promise.resolve(geminiResponse()));

    await provider.recognise({ image, context: 'Lunch', nutritionCatalog: catalog });

    const params = (generateContent.mock.calls[0] as unknown[])[0] as {
      model: string;
      contents: { parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] }[];
      config: {
        systemInstruction: string;
        responseMimeType: string;
        responseJsonSchema: { $schema?: string; properties: Record<string, object> };
        thinkingConfig: { thinkingLevel: string };
      };
    };
    expect(params.model).toBe('gemini-3.8-flash');
    const [photo, text] = params.contents[0]!.parts;
    expect(photo!.inlineData).toEqual({
      mimeType: 'image/jpeg',
      data: Buffer.from('jpeg bytes').toString('base64'),
    });
    expect(text!.text).toContain('<user_notes>\nLunch\n</user_notes>');
    expect(params.config.systemInstruction).toContain('jollof_rice: Jollof rice (also: jollof)');
    expect(params.config.responseMimeType).toBe('application/json');
    expect(params.config.responseJsonSchema.$schema).toBeUndefined();
    expect(Object.keys(params.config.responseJsonSchema.properties)).toEqual([
      'contains_food',
      'items',
      'meal_calorie_estimate',
    ]);
    expect(params.config.thinkingConfig.thinkingLevel).toBe('MEDIUM');
  });

  it('maps effort to thinking levels, capped at HIGH', async () => {
    for (const [effort, level] of [
      ['low', 'LOW'],
      ['max', 'HIGH'],
    ] as const) {
      const { provider, generateContent } = providerWith(Promise.resolve(geminiResponse()), effort);
      await provider.recognise({ image, nutritionCatalog: catalog });
      const params = (generateContent.mock.calls[0] as unknown[])[0] as {
        config: { thinkingConfig: { thinkingLevel: string } };
      };
      expect(params.config.thinkingConfig.thinkingLevel).toBe(level);
    }
  });

  it('returns the same normalised result as the Claude provider', async () => {
    const result = await recognise(Promise.resolve(geminiResponse()));

    expect(result).toMatchObject({
      provider: 'gemini',
      model: 'gemini-3.8-flash-001',
      modelCalorieEstimate: 640,
      raw: answer,
      // Thinking tokens count as output.
      usage: { inputTokens: 1800, outputTokens: 800 },
    });
    expect(result.items).toEqual([
      {
        name: 'jollof rice',
        nutritionKey: 'jollof_rice',
        estimatedGrams: 320,
        portionDescription: '1 plate',
        confidence: 0.9,
      },
      {
        name: 'zobo drink',
        nutritionKey: null,
        estimatedGrams: 300,
        portionDescription: '1 glass',
        confidence: 1,
      },
    ]);
  });

  it('rejects answers that are not valid JSON or do not fit the schema', async () => {
    const badKey = { ...answer, items: [{ ...answer.items[0]!, nutrition_key: 'pizza' }] };
    for (const response of [
      geminiResponse({ text: 'not json' }),
      geminiResponse({ text: JSON.stringify(badKey) }),
      geminiResponse({ text: undefined }),
      geminiResponse({ candidates: [{ finishReason: 'MAX_TOKENS' }] }),
    ]) {
      await expect(recognise(Promise.resolve(response))).rejects.toMatchObject({
        statusCode: 502,
        code: 'AI_INVALID_RESPONSE',
      });
    }
  });

  it('reports safety blocks as AI_REFUSED', async () => {
    for (const response of [
      geminiResponse({
        promptFeedback: { blockReason: 'SAFETY' },
        candidates: [],
        text: undefined,
      }),
      geminiResponse({ candidates: [{ finishReason: 'IMAGE_SAFETY' }] }),
    ]) {
      await expect(recognise(Promise.resolve(response))).rejects.toMatchObject({
        statusCode: 422,
        code: 'AI_REFUSED',
      });
    }
  });

  it('maps API failures to the same error codes as the Claude provider', async () => {
    const apiError = (status: number, message: string) => new ApiError({ status, message });
    const cases: [Error, number, string][] = [
      [apiError(400, 'API key not valid. Please pass a valid API key.'), 503, 'AI_NOT_CONFIGURED'],
      [apiError(403, 'Permission denied'), 503, 'AI_NOT_CONFIGURED'],
      [apiError(429, 'Resource exhausted'), 503, 'AI_RATE_LIMITED'],
      [apiError(400, 'Invalid JSON schema'), 502, 'AI_REQUEST_FAILED'],
      [apiError(404, 'models/gemini-x is not found'), 502, 'AI_REQUEST_FAILED'],
      [apiError(503, 'The model is overloaded'), 503, 'AI_UNAVAILABLE'],
      [new TypeError('fetch failed'), 503, 'AI_UNAVAILABLE'],
    ];
    for (const [error, statusCode, code] of cases) {
      await expect(recognise(Promise.reject(error)), code).rejects.toMatchObject({
        statusCode,
        code,
      });
    }
  });
});
