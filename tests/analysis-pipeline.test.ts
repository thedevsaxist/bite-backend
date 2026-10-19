import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { foodAnalyses } from '../src/db/schema/index.js';
import { foodRecognitionProvider } from '../src/integrations/ai/index.js';
import { AppError } from '../src/utils/app-error.js';
import { aiAnswer, jollofPlantainZobo } from './fake-ai.js';
import { blurryJpeg, sharpJpeg } from './images.js';
import { signUp } from './helpers.js';

// The AI provider is replaced with a fake whose answer each test sets.
const { recognise } = vi.hoisted(() => ({ recognise: vi.fn() }));
vi.mock('../src/integrations/ai/index.js', () => ({
  foodRecognitionProvider: vi.fn(() => ({ name: 'fake', recognise })),
}));

const app = createApp();

async function analyse(auth: string, fields: { context?: string } = {}) {
  const req = request(app).post('/api/v1/analyses').set('Authorization', auth);
  if (fields.context !== undefined) req.field('context', fields.context);
  return req.attach('image', await sharpJpeg(), 'meal.jpg');
}

const storedAnalyses = (userId: string) =>
  db.select().from(foodAnalyses).where(eq(foodAnalyses.userId, userId)).all();

const userPhotoFolder = (userId: string) => path.join(process.env.UPLOAD_DIR!, userId);

beforeEach(() => {
  recognise.mockReset();
});

describe('POST /analyses', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/analyses')
      .attach('image', await sharpJpeg(), 'meal.jpg');
    expect(res.status).toBe(401);
  });

  it('analyses a photo: recognition, nutrition matching and calorie totals', async () => {
    const { auth, userId } = await signUp(app);
    recognise.mockResolvedValue(jollofPlantainZobo);

    const res = await analyse(auth, { context: '  Lunch, cooked with palm oil ' });

    expect(res.status).toBe(201);
    const analysis = res.body.data.analysis;
    expect(analysis).toMatchObject({
      status: 'completed',
      additionalContext: 'Lunch, cooked with palm oil',
      ai: { provider: 'anthropic', model: 'claude-opus-5-5', inputTokens: 2100, outputTokens: 450 },
      failureReason: null,
      unmatchedItemCount: 1,
      processingTimeMs: expect.any(Number),
    });
    expect(analysis.items).toMatchObject([
      {
        name: 'jollof rice',
        nutritionReference: { key: 'jollof_rice' },
        portion: { description: '1 plate', quantity: 300, unit: 'g' },
        confidence: 0.93,
        nutrients: { calories: 495, protein: 9, carbohydrates: 81, fat: 15 },
      },
      {
        name: 'fried plantain',
        nutritionReference: { key: 'fried_plantain' },
        portion: { description: 'a few slices', quantity: 1, unit: 'serving' },
        nutrients: { calories: 405 },
      },
      {
        name: 'zobo drink',
        nutritionReference: null,
        portion: { quantity: 300, unit: 'g' },
        nutrients: null,
      },
    ]);
    // 495 + 405; the unmatched drink is left out.
    expect(analysis.totals.calories).toBe(900);

    // What the provider was given.
    const input = recognise.mock.calls[0]![0];
    expect(input.context).toBe('Lunch, cooked with palm oil');
    expect(input.image.mediaType).toBe('image/jpeg');
    expect(input.nutritionCatalog.map((f: { key: string }) => f.key)).toContain('jollof_rice');

    // The photo was stored and the raw AI answer kept unchanged.
    const [stored] = storedAnalyses(userId);
    expect(stored!.aiResult).toEqual({ model_answer: 'as received' });
    expect(fs.readdirSync(userPhotoFolder(userId))).toHaveLength(1);

    // The same analysis can be fetched again.
    const fetched = await request(app)
      .get(`/api/v1/analyses/${analysis.id}`)
      .set('Authorization', auth);
    expect(fetched.body.data.analysis.items).toHaveLength(3);
  });

  it('records a photo with no food as failed and returns NO_FOOD_DETECTED', async () => {
    const { auth, userId } = await signUp(app);
    recognise.mockResolvedValue(aiAnswer([]));

    const res = await analyse(auth);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NO_FOOD_DETECTED');
    const [stored] = storedAnalyses(userId);
    expect(res.body.error.details.analysisId).toBe(stored!.id);
    expect(stored).toMatchObject({
      analysisStatus: 'failed',
      failureReason: 'NO_FOOD_DETECTED',
      aiResult: { model_answer: 'as received' },
      aiModel: 'claude-opus-5-5',
    });
  });

  it('records an AI failure and passes its error on with the analysis id', async () => {
    const { auth, userId } = await signUp(app);
    recognise.mockRejectedValue(
      new AppError(503, 'Food recognition is unavailable', 'AI_UNAVAILABLE'),
    );

    const res = await analyse(auth);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
    const [stored] = storedAnalyses(userId);
    expect(res.body.error.details).toEqual({ analysisId: stored!.id });
    expect(stored).toMatchObject({ analysisStatus: 'failed', failureReason: 'AI_UNAVAILABLE' });
    expect(stored!.processingTimeMs).toEqual(expect.any(Number));
  });

  it('records unexpected errors as INTERNAL_ERROR', async () => {
    const { auth, userId } = await signUp(app);
    recognise.mockRejectedValue(new TypeError('something broke'));

    const res = await analyse(auth);

    expect(res.status).toBe(500);
    expect(storedAnalyses(userId)[0]).toMatchObject({
      analysisStatus: 'failed',
      failureReason: 'INTERNAL_ERROR',
    });
  });

  it('stores nothing when food recognition is not set up', async () => {
    const { auth, userId } = await signUp(app);
    vi.mocked(foodRecognitionProvider).mockImplementationOnce(() => {
      throw new AppError(503, 'Food recognition is not set up yet', 'AI_NOT_CONFIGURED');
    });

    const res = await analyse(auth);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');
    expect(storedAnalyses(userId)).toHaveLength(0);
    expect(fs.existsSync(userPhotoFolder(userId))).toBe(false);
  });

  it('rejects an unusable photo before calling the AI or storing anything', async () => {
    const { auth, userId } = await signUp(app);

    const blurry = await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', auth)
      .attach('image', await blurryJpeg(), 'meal.jpg');
    const missing = await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', auth)
      .field('context', 'rice');

    expect(blurry.status).toBe(422);
    expect(blurry.body.error.code).toBe('IMAGE_TOO_BLURRY');
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('IMAGE_REQUIRED');
    expect(recognise).not.toHaveBeenCalled();
    expect(storedAnalyses(userId)).toHaveLength(0);
  });

  it('validates the meal notes', async () => {
    const { auth } = await signUp(app);

    const res = await analyse(auth, { context: 'x'.repeat(1001) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(recognise).not.toHaveBeenCalled();
  });

  it('treats empty notes as no notes', async () => {
    const { auth } = await signUp(app);
    recognise.mockResolvedValue(jollofPlantainZobo);

    const res = await analyse(auth, { context: '   ' });

    expect(res.body.data.analysis.additionalContext).toBeNull();
    expect(recognise.mock.calls[0]![0].context).toBeUndefined();
  });
});
