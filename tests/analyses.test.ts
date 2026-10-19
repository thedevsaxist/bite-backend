import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { foodAnalyses, recognisedFoodItems, users } from '../src/db/schema/index.js';
import { imageStore } from '../src/integrations/storage/index.js';
import { analysesRepository } from '../src/modules/analyses/analyses.repository.js';
import { deleteImage, saveImage } from '../src/modules/analyses/image-storage.js';
import { calculateItemNutrients } from '../src/modules/nutrition/calorie-calculator.js';
import { nutritionRepository } from '../src/modules/nutrition/nutrition.repository.js';
import { signUp } from './helpers.js';

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * A completed analysis of jollof rice with fried plantain, plus an item no reference food matches.
 * POST /analyses arrives in stage 8, so it is written through the repository.
 */
async function createCompletedAnalysis(userId: string) {
  const jollof = nutritionRepository.search('jollof', 1)[0]!;
  const dodo = nutritionRepository.search('dodo', 1)[0]!;
  const imageReference = await saveImage(userId, Buffer.from('jpeg bytes'));

  const analysis = analysesRepository.create({
    userId,
    imageReference,
    additionalContext: 'Lunch, cooked with palm oil',
    analysisStatus: 'completed',
    aiResult: { items: ['jollof rice', 'fried plantain', 'zobo drink'] },
    aiProvider: 'anthropic',
    aiModel: 'test-model',
    processingTimeMs: 4200,
    analysedAt: new Date(),
  });
  // Listed out of order to check the response follows `position`.
  analysesRepository.createItems([
    {
      analysisId: analysis.id,
      position: 2,
      foodName: 'zobo drink',
      portionDescription: '1 glass',
      recognitionConfidence: 0.6,
    },
    {
      analysisId: analysis.id,
      position: 0,
      foodName: 'jollof rice',
      nutritionReferenceId: jollof.id,
      portionDescription: '1 plate',
      estimatedQuantity: 300,
      quantityUnit: 'g',
      recognitionConfidence: 0.92,
      ...calculateItemNutrients(jollof, { quantity: 300, unit: 'g' }),
    },
    {
      analysisId: analysis.id,
      position: 1,
      foodName: 'fried plantain',
      nutritionReferenceId: dodo.id,
      portionDescription: 'about 6 slices',
      estimatedQuantity: 1,
      quantityUnit: 'serving',
      recognitionConfidence: 0.88,
      ...calculateItemNutrients(dodo, { quantity: 1, unit: 'serving' }),
    },
  ]);
  return { analysis, jollof, dodo };
}

const get = (path: string, auth: string) => request(app).get(path).set('Authorization', auth);

describe('GET /analyses/:id', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/v1/analyses/anything')).status).toBe(401);
  });

  it('returns the analysis with its items in order and the meal totals', async () => {
    const { auth, userId } = await signUp(app);
    const { analysis, jollof } = await createCompletedAnalysis(userId);

    const res = await get(`/api/v1/analyses/${analysis.id}`, auth);

    expect(res.status).toBe(200);
    const body = res.body.data.analysis;
    expect(body).toMatchObject({
      id: analysis.id,
      status: 'completed',
      additionalContext: 'Lunch, cooked with palm oil',
      // Tests store photos locally, which has no signed links.
      imageUrl: null,
      ai: { provider: 'anthropic', model: 'test-model' },
      processingTimeMs: 4200,
      failureReason: null,
      unmatchedItemCount: 1,
    });
    expect(body.items.map((item: { name: string }) => item.name)).toEqual([
      'jollof rice',
      'fried plantain',
      'zobo drink',
    ]);
    expect(body.items[0]).toMatchObject({
      nutritionReference: { id: jollof.id, key: 'jollof_rice', name: 'Jollof rice' },
      portion: { description: '1 plate', quantity: 300, unit: 'g' },
      confidence: 0.92,
      // 300 g of jollof at 165 kcal / 100 g
      nutrients: { calories: 495, protein: 9, carbohydrates: 81, fat: 15 },
    });
    // 1 serving of fried plantain = 150 g at 270 kcal / 100 g = 405 kcal
    expect(body.items[1].nutrients.calories).toBe(405);
    expect(body.items[2]).toMatchObject({ nutritionReference: null, nutrients: null });
    // Totals include only the two matched items.
    expect(body.totals).toEqual({ calories: 900, protein: 11, carbohydrates: 141, fat: 33 });
  });

  it('includes a signed photo link when the store provides one', async () => {
    const { auth, userId } = await signUp(app);
    const { analysis } = await createCompletedAnalysis(userId);
    const signedUrl = vi
      .spyOn(imageStore(), 'signedUrl')
      .mockResolvedValue('https://project.supabase.co/storage/v1/object/sign/x?token=t');

    const res = await get(`/api/v1/analyses/${analysis.id}`, auth);

    expect(res.body.data.analysis.imageUrl).toMatch(/token=t$/);
    expect(signedUrl).toHaveBeenCalledWith(analysis.imageReference, 3600);
  });

  it('shows a failed analysis without totals', async () => {
    const { auth, userId } = await signUp(app);
    const failed = analysesRepository.create({
      userId,
      imageReference: `${userId}/failed.jpg`,
      analysisStatus: 'failed',
      failureReason: 'NO_FOOD_DETECTED',
      analysedAt: new Date(),
    });

    const res = await get(`/api/v1/analyses/${failed.id}`, auth);

    expect(res.status).toBe(200);
    expect(res.body.data.analysis).toMatchObject({
      status: 'failed',
      failureReason: 'NO_FOOD_DETECTED',
      items: [],
      totals: null,
      unmatchedItemCount: 0,
    });
  });

  it("hides other users' analyses and unknown ids behind the same 404", async () => {
    const owner = await signUp(app);
    const other = await signUp(app);
    const { analysis } = await createCompletedAnalysis(owner.userId);

    const notYours = await get(`/api/v1/analyses/${analysis.id}`, other.auth);
    const unknown = await get('/api/v1/analyses/does-not-exist', other.auth);

    for (const res of [notYours, unknown]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ANALYSIS_NOT_FOUND');
    }
  });
});

describe('GET /analyses/:id/image', () => {
  it('returns the photo as a private JPEG', async () => {
    const { auth, userId } = await signUp(app);
    const { analysis } = await createCompletedAnalysis(userId);

    const res = await get(`/api/v1/analyses/${analysis.id}/image`, auth).buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['cache-control']).toBe('private, max-age=3600');
    expect(Buffer.from(res.body).toString()).toBe('jpeg bytes');
  });

  it("returns IMAGE_NOT_FOUND when the photo is gone, and 404 for others' analyses", async () => {
    const owner = await signUp(app);
    const other = await signUp(app);
    const { analysis } = await createCompletedAnalysis(owner.userId);

    const notYours = await get(`/api/v1/analyses/${analysis.id}/image`, other.auth);
    await deleteImage(analysis.imageReference);
    const gone = await get(`/api/v1/analyses/${analysis.id}/image`, owner.auth);

    expect(notYours.status).toBe(404);
    expect(notYours.body.error.code).toBe('ANALYSIS_NOT_FOUND');
    expect(gone.status).toBe(404);
    expect(gone.body.error.code).toBe('IMAGE_NOT_FOUND');
  });
});

describe('analysis records', () => {
  it('are deleted with the user, along with their items', async () => {
    const { userId } = await signUp(app);
    const { analysis } = await createCompletedAnalysis(userId);
    const itemCount = () =>
      db
        .select()
        .from(recognisedFoodItems)
        .where(eq(recognisedFoodItems.analysisId, analysis.id))
        .all().length;
    expect(itemCount()).toBe(3);

    db.delete(users).where(eq(users.id, userId)).run();

    expect(db.select().from(foodAnalyses).where(eq(foodAnalyses.id, analysis.id)).get()).toBe(
      undefined,
    );
    expect(itemCount()).toBe(0);
  });
});
