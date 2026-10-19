import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  createAnthropicProvider,
  normaliseResponse,
} from '../src/integrations/ai/providers/anthropic.js';
import {
  buildResponseSchema,
  buildSystemPrompt,
  buildUserText,
  type RecognitionResponse,
} from '../src/integrations/ai/prompt.js';
import type { CatalogFood } from '../src/integrations/ai/food-recognition.js';
import { nutritionRepository } from '../src/modules/nutrition/nutrition.repository.js';

const catalog: CatalogFood[] = [
  { key: 'jollof_rice', name: 'Jollof rice', aliases: ['jollof'] },
  { key: 'fried_plantain', name: 'Fried plantain', aliases: ['dodo'] },
  { key: 'banana', name: 'Banana', aliases: [] },
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
      confidence: 0.93,
    },
    {
      name: 'zobo drink',
      nutrition_key: null,
      estimated_grams: 300,
      portion_description: '1 glass',
      confidence: 0.6,
    },
  ],
  meal_calorie_estimate: 640,
};

/** A fake Anthropic client whose parse() resolves (or rejects) with what a test gives it. */
function fakeClient(result: Promise<unknown>) {
  const parse = vi.fn(() => result);
  return { client: { beta: { messages: { parse } } } as never, parse };
}

const message = (overrides: Record<string, unknown> = {}) => ({
  model: 'claude-opus-5-5',
  stop_reason: 'end_turn',
  stop_details: null,
  parsed_output: answer,
  usage: { input_tokens: 2100, output_tokens: 450 },
  ...overrides,
});

const providerWith = (result: Promise<unknown>) => {
  const { client, parse } = fakeClient(result);
  const provider = createAnthropicProvider({
    apiKey: 'sk-ant-test',
    model: 'claude-opus-5-5',
    effort: 'medium',
    timeoutMs: 90_000,
    client,
  });
  return { provider, parse };
};

const recognise = (result: Promise<unknown>, context?: string) =>
  providerWith(result).provider.recognise({ image, context, nutritionCatalog: catalog });

describe('prompt', () => {
  it('lists the catalog with aliases in the system prompt', () => {
    const prompt = buildSystemPrompt(catalog);
    expect(prompt).toContain('jollof_rice: Jollof rice (also: jollof)');
    // A food without aliases gets no "(also: …)".
    expect(prompt).toMatch(/^banana: Banana$/m);
  });

  it('sets the user notes apart from the request', () => {
    expect(buildUserText({})).toBe('Analyse the meal in this photo.');
    expect(buildUserText({ context: '   ' })).toBe('Analyse the meal in this photo.');
    expect(buildUserText({ context: ' Half a plate, cooked with palm oil ' })).toBe(
      'Analyse the meal in this photo.\n\n<user_notes>\nHalf a plate, cooked with palm oil\n</user_notes>',
    );
  });

  it('only accepts catalog keys or null for nutrition_key', () => {
    const schema = buildResponseSchema(catalog);
    const withKey = (nutrition_key: string | null) => ({
      ...answer,
      items: [{ ...answer.items[0]!, nutrition_key }],
    });

    expect(schema.safeParse(withKey('fried_plantain')).success).toBe(true);
    expect(schema.safeParse(withKey(null)).success).toBe(true);
    expect(schema.safeParse(withKey('pizza')).success).toBe(false);
  });

  it('works with an empty catalog', () => {
    expect(buildResponseSchema([]).safeParse(answer).success).toBe(true);
  });
});

describe('normaliseResponse', () => {
  it('returns no items when the photo has no food', () => {
    expect(normaliseResponse({ ...answer, contains_food: false }).items).toEqual([]);
  });

  it('cleans up values outside the ranges the schema cannot express', () => {
    const { items, modelCalorieEstimate } = normaliseResponse({
      contains_food: true,
      items: [
        {
          name: '  egusi soup ',
          nutrition_key: 'egusi_soup',
          estimated_grams: 254.37,
          portion_description: ' ',
          confidence: 1.4,
        },
        {
          name: 'eba',
          nutrition_key: 'eba',
          estimated_grams: 0,
          portion_description: '1 wrap',
          confidence: -0.2,
        },
        {
          name: '   ',
          nutrition_key: null,
          estimated_grams: 10,
          portion_description: 'x',
          confidence: 0.5,
        },
      ],
      meal_calorie_estimate: -5,
    });

    expect(items).toEqual([
      {
        name: 'egusi soup',
        nutritionKey: 'egusi_soup',
        estimatedGrams: 254.4,
        portionDescription: null,
        confidence: 1,
      },
      {
        name: 'eba',
        nutritionKey: 'eba',
        estimatedGrams: null,
        portionDescription: '1 wrap',
        confidence: 0,
      },
    ]);
    expect(modelCalorieEstimate).toBeNull();
  });
});

describe('Anthropic provider', () => {
  it('sends the photo, notes, catalog and schema with structured outputs and fallbacks', async () => {
    const { provider, parse } = providerWith(Promise.resolve(message()));

    await provider.recognise({ image, context: 'Lunch', nutritionCatalog: catalog });

    const params = (parse.mock.calls[0] as unknown[])[0] as Record<string, unknown> & {
      output_config: { effort: string; format: { type: string; schema: { properties: object } } };
      system: { text: string; cache_control: object }[];
      messages: { content: { type: string; source?: { data: string }; text?: string }[] }[];
    };
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    expect(params).not.toHaveProperty('thinking');
    expect(params.output_config.effort).toBe('medium');
    expect(params.output_config.format.type).toBe('json_schema');
    expect(Object.keys(params.output_config.format.schema.properties)).toEqual([
      'contains_food',
      'items',
      'meal_calorie_estimate',
    ]);
    expect(params.system[0]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(params.system[0]!.text).toContain('jollof_rice: Jollof rice');
    const [imageBlock, textBlock] = params.messages[0]!.content;
    expect(imageBlock!.source!.data).toBe(Buffer.from('jpeg bytes').toString('base64'));
    expect(textBlock!.text).toContain('<user_notes>\nLunch\n</user_notes>');
  });

  it('returns the normalised items, the raw answer, the serving model and token usage', async () => {
    const result = await recognise(Promise.resolve(message({ model: 'claude-opus-4-8' })));

    expect(result).toMatchObject({
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      modelCalorieEstimate: 640,
      raw: answer,
      usage: { inputTokens: 2100, outputTokens: 450 },
    });
    expect(result.items.map((item) => item.nutritionKey)).toEqual(['jollof_rice', null]);
  });

  it('reports a declined photo as AI_REFUSED and an unusable answer as AI_INVALID_RESPONSE', async () => {
    await expect(
      recognise(Promise.resolve(message({ stop_reason: 'refusal', parsed_output: null }))),
    ).rejects.toMatchObject({ statusCode: 422, code: 'AI_REFUSED' });
    await expect(
      recognise(Promise.resolve(message({ stop_reason: 'max_tokens' }))),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_INVALID_RESPONSE',
    });
    await expect(
      recognise(Promise.resolve(message({ parsed_output: null }))),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_INVALID_RESPONSE',
    });
    await expect(
      recognise(Promise.reject(new SyntaxError('Unexpected token'))),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_INVALID_RESPONSE',
    });
  });

  it('maps API failures to clear error codes', async () => {
    const headers = new Headers();
    const cases: [Error, number, string][] = [
      [
        new Anthropic.AuthenticationError(401, undefined, 'invalid x-api-key', headers),
        503,
        'AI_NOT_CONFIGURED',
      ],
      [
        new Anthropic.RateLimitError(429, undefined, 'rate limited', headers),
        503,
        'AI_RATE_LIMITED',
      ],
      [
        new Anthropic.BadRequestError(400, undefined, 'bad request', headers),
        502,
        'AI_REQUEST_FAILED',
      ],
      [
        new Anthropic.InternalServerError(529, undefined, 'overloaded', headers),
        503,
        'AI_UNAVAILABLE',
      ],
      [new Anthropic.APIConnectionTimeoutError(), 503, 'AI_UNAVAILABLE'],
    ];

    for (const [error, statusCode, code] of cases) {
      await expect(recognise(Promise.reject(error)), code).rejects.toMatchObject({
        statusCode,
        code,
      });
    }
  });
});

describe('nutrition catalog', () => {
  it('lists every seeded food with its key, name and aliases', () => {
    const list = nutritionRepository.listCatalog();
    expect(list.length).toBeGreaterThan(50);
    expect(list.find((food) => food.key === 'fried_plantain')).toMatchObject({
      name: 'Fried plantain',
      aliases: expect.arrayContaining(['dodo']),
    });
  });
});
