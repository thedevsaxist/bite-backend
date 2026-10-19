import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { Mock } from 'vitest';
import type { RecognisedItem, RecognitionResult } from '../src/integrations/ai/index.js';
import { sharpJpeg } from './images.js';

// Shared answers for tests that replace the AI provider with a fake. Each such test file still
// calls vi.mock itself, because Vitest only hoists mocks declared in the test file.

export const item = (overrides: Partial<RecognisedItem>): RecognisedItem => ({
  name: 'food',
  nutritionKey: null,
  estimatedGrams: null,
  portionDescription: null,
  confidence: 0.9,
  ...overrides,
});

export const aiAnswer = (items: RecognisedItem[]): RecognitionResult => ({
  items,
  modelCalorieEstimate: 950,
  raw: { model_answer: 'as received' },
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  usage: { inputTokens: 2100, outputTokens: 450 },
});

/**
 * Jollof (300 g, 495 kcal), fried plantain (1 serving = 150 g, 405 kcal) and zobo (no reference
 * food): 900 kcal, 11 g protein, 141 g carbohydrates, 33 g fat in total.
 */
export const jollofPlantainZobo = aiAnswer([
  item({
    name: 'jollof rice',
    nutritionKey: 'jollof_rice',
    estimatedGrams: 300,
    portionDescription: '1 plate',
    confidence: 0.93,
  }),
  item({
    name: 'fried plantain',
    nutritionKey: 'fried_plantain',
    portionDescription: 'a few slices',
  }),
  item({ name: 'zobo drink', estimatedGrams: 300, portionDescription: '1 glass', confidence: 0.6 }),
]);

/** Runs POST /analyses with the fake provider answering `answer`, and returns the analysis. */
export async function analyseWith(
  app: App,
  recognise: Mock,
  auth: string,
  answer = jollofPlantainZobo,
) {
  recognise.mockResolvedValueOnce(answer);
  const res = await request(app)
    .post('/api/v1/analyses')
    .set('Authorization', auth)
    .attach('image', await sharpJpeg(), 'meal.jpg');
  if (res.status !== 201) throw new Error(`Analysis failed: ${JSON.stringify(res.body)}`);
  return res.body.data.analysis;
}
