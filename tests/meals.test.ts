import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { nutritionRepository } from '../src/modules/nutrition/nutrition.repository.js';
import { aiAnswer, analyseWith } from './fake-ai.js';
import { signUp } from './helpers.js';

const { recognise } = vi.hoisted(() => ({ recognise: vi.fn() }));
vi.mock('../src/integrations/ai/index.js', () => ({
  foodRecognitionProvider: vi.fn(() => ({ name: 'fake', recognise })),
}));

const app = createApp();

beforeEach(() => {
  recognise.mockReset();
});

const api = (auth: string) => ({
  get: (path: string) => request(app).get(`/api/v1${path}`).set('Authorization', auth),
  post: (path: string, body: object = {}) =>
    request(app).post(`/api/v1${path}`).set('Authorization', auth).send(body),
  patch: (path: string, body: object = {}) =>
    request(app).patch(`/api/v1${path}`).set('Authorization', auth).send(body),
  delete: (path: string) => request(app).delete(`/api/v1${path}`).set('Authorization', auth),
});

async function userWithAutoSave(autoSave: boolean) {
  const user = await signUp(app);
  if (!autoSave) await api(user.auth).patch('/settings', { autoSaveResults: false });
  return { ...user, api: api(user.auth) };
}

const egusiId = () => nutritionRepository.search('egusi', 1)[0]!.id;

type Item = { id: string; name: string; portion: { quantity: number; unit: string } };
/** The analysis's items as edit inputs, unchanged. */
const asEdits = (items: Item[] & { nutritionReference: { id: string } | null }[]) =>
  items.map((it) => ({
    recognisedItemId: it.id,
    name: it.name,
    nutritionReferenceId: it.nutritionReference?.id ?? null,
    quantity: it.portion.quantity,
    unit: it.portion.unit,
  }));

describe('auto-save on (the default)', () => {
  it('saves every completed analysis to the history as it was recognised', async () => {
    const user = await userWithAutoSave(true);
    const analysis = await analyseWith(app, recognise, user.auth);

    expect(analysis.meal).toMatchObject({ status: 'saved', validatedByUser: false });

    const res = await user.api.get(`/meals/${analysis.meal.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.meal).toMatchObject({
      analysisId: analysis.id,
      mealDate: analysis.createdAt,
      status: 'saved',
      validatedByUser: false,
      totals: { calories: 900, protein: 11, carbohydrates: 141, fat: 33 },
      unmatchedItemCount: 1,
      imageUrl: null,
    });
    expect(res.body.data.meal.items).toMatchObject([
      {
        name: 'jollof rice',
        recognisedItemId: analysis.items[0].id,
        portion: { quantity: 300, unit: 'g' },
        wasModified: false,
      },
      {
        name: 'fried plantain',
        portion: { quantity: 1, unit: 'serving' },
        nutrients: { calories: 405 },
      },
      { name: 'zobo drink', nutritionReference: null, nutrients: null },
    ]);
  });

  it('does not save failed analyses', async () => {
    const user = await userWithAutoSave(true);
    recognise.mockResolvedValueOnce(aiAnswer([]));
    await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', user.auth)
      .attach('image', await (await import('./images.js')).sharpJpeg(), 'meal.jpg');

    expect((await user.api.get('/meals')).body.data.meals).toEqual([]);
  });
});

describe('auto-save off: POST /analyses/:id/validate', () => {
  it('leaves the result out of the history until the user validates it', async () => {
    const user = await userWithAutoSave(false);
    const analysis = await analyseWith(app, recognise, user.auth);
    expect(analysis.meal).toBeNull();
    expect((await user.api.get('/meals')).body.data.meals).toEqual([]);

    const res = await user.api.post(`/analyses/${analysis.id}/validate`);

    expect(res.status).toBe(201);
    expect(res.body.data.meal).toMatchObject({
      status: 'saved',
      validatedByUser: true,
      totals: { calories: 900 },
    });
    expect(res.body.data.meal.items.every((it: { wasModified: boolean }) => !it.wasModified)).toBe(
      true,
    );
    const updated = await user.api.get(`/analyses/${analysis.id}`);
    expect(updated.body.data.analysis.meal.id).toBe(res.body.data.meal.id);
  });

  it('saves the user corrections and recalculates nutrients, leaving the analysis unchanged', async () => {
    const user = await userWithAutoSave(false);
    const analysis = await analyseWith(app, recognise, user.auth);
    const [jollof, plantain, zobo] = asEdits(analysis.items);

    const res = await user.api.post(`/analyses/${analysis.id}/validate`, {
      mealDate: '2026-10-14T13:15:00+01:00',
      items: [
        // Half the rice the AI estimated.
        { ...jollof, quantity: 150 },
        // Unchanged.
        plantain,
        // Not in the reference data: the user gives the calories.
        { ...zobo, name: 'zobo (sweetened)', quantity: 330, unit: 'ml', calories: 120 },
        // Something the AI missed.
        { name: 'egusi soup', nutritionReferenceId: egusiId(), quantity: 250, unit: 'g' },
      ],
    });

    expect(res.status).toBe(201);
    const meal = res.body.data.meal;
    expect(meal.mealDate).toBe('2026-10-14T12:15:00.000Z');
    expect(meal.items).toMatchObject([
      {
        name: 'jollof rice',
        portion: { quantity: 150, unit: 'g' },
        nutrients: { calories: 247.5 },
        wasModified: true,
      },
      { name: 'fried plantain', nutrients: { calories: 405 }, wasModified: false },
      {
        name: 'zobo (sweetened)',
        nutritionReference: null,
        nutrients: { calories: 120, protein: 0, carbohydrates: 0, fat: 0 },
        wasModified: true,
      },
      {
        name: 'egusi soup',
        recognisedItemId: null,
        nutritionReference: { key: 'egusi_soup' },
        nutrients: { calories: 500 },
        wasModified: true,
      },
    ]);
    expect(meal.totals.calories).toBe(1272.5);
    expect(meal.unmatchedItemCount).toBe(0);

    // The original AI result is kept as it was.
    const original = await user.api.get(`/analyses/${analysis.id}`);
    expect(original.body.data.analysis.items[0].portion.quantity).toBe(300);
    expect(original.body.data.analysis.totals.calories).toBe(900);
  });

  it('can only be done once per analysis', async () => {
    const user = await userWithAutoSave(false);
    const analysis = await analyseWith(app, recognise, user.auth);
    const first = await user.api.post(`/analyses/${analysis.id}/validate`);

    const again = await user.api.post(`/analyses/${analysis.id}/validate`);

    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({
      code: 'MEAL_ALREADY_SAVED',
      details: { mealId: first.body.data.meal.id },
    });
  });

  it('rejects edits that do not fit the analysis or the reference data', async () => {
    const user = await userWithAutoSave(false);
    const analysis = await analyseWith(app, recognise, user.auth);
    const other = await analyseWith(app, recognise, user.auth);
    const [jollof] = asEdits(analysis.items);
    const validateWith = (items: object[]) =>
      user.api.post(`/analyses/${analysis.id}/validate`, { items });

    const cases: [object, string][] = [
      [{ ...jollof, recognisedItemId: other.items[0].id }, 'UNKNOWN_RECOGNISED_ITEM'],
      [{ ...jollof, nutritionReferenceId: 'no-such-food' }, 'UNKNOWN_NUTRITION_REFERENCE'],
      [{ ...jollof, calories: 100 }, 'VALIDATION_ERROR'],
      [{ name: 'mystery stew', quantity: 1, unit: 'serving' }, 'PORTION_NEEDS_REFERENCE'],
      [{ ...jollof, quantity: 0 }, 'VALIDATION_ERROR'],
    ];
    for (const [edit, code] of cases) {
      const res = await validateWith([edit]);
      expect(res.status, code).toBe(400);
      expect(res.body.error.code, code).toBe(code);
    }
    expect((await validateWith([])).status).toBe(400);
    // Nothing was saved along the way.
    expect((await user.api.get('/meals')).body.data.meals).toEqual([]);
  });

  it("refuses failed analyses and other users' analyses", async () => {
    const user = await userWithAutoSave(false);
    recognise.mockResolvedValueOnce(aiAnswer([]));
    const failed = await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', user.auth)
      .attach('image', await (await import('./images.js')).sharpJpeg(), 'meal.jpg');
    const someoneElse = await userWithAutoSave(false);
    const theirs = await analyseWith(app, recognise, someoneElse.auth);

    const notCompleted = await user.api.post(
      `/analyses/${failed.body.error.details.analysisId}/validate`,
    );
    const notYours = await user.api.post(`/analyses/${theirs.id}/validate`);

    expect(notCompleted.status).toBe(409);
    expect(notCompleted.body.error.code).toBe('ANALYSIS_NOT_COMPLETED');
    expect(notYours.status).toBe(404);
  });
});

describe('PATCH /meals/:id', () => {
  it('edits a saved meal and marks it as reviewed', async () => {
    const user = await userWithAutoSave(true);
    const analysis = await analyseWith(app, recognise, user.auth);
    const [jollof] = asEdits(analysis.items);

    const res = await user.api.patch(`/meals/${analysis.meal.id}`, {
      items: [{ ...jollof, quantity: 400 }],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.meal).toMatchObject({
      validatedByUser: true,
      totals: { calories: 660 },
      items: [{ name: 'jollof rice', wasModified: true }],
    });
  });

  it('confirms a meal as it is when sent no changes', async () => {
    const user = await userWithAutoSave(true);
    const analysis = await analyseWith(app, recognise, user.auth);

    const res = await user.api.patch(`/meals/${analysis.meal.id}`, {});

    expect(res.body.data.meal).toMatchObject({ validatedByUser: true, totals: { calories: 900 } });
    expect(res.body.data.meal.items).toHaveLength(3);
  });

  it("returns MEAL_NOT_FOUND for other users' meals", async () => {
    const owner = await userWithAutoSave(true);
    const other = await userWithAutoSave(true);
    const analysis = await analyseWith(app, recognise, owner.auth);

    for (const res of [
      await other.api.get(`/meals/${analysis.meal.id}`),
      await other.api.patch(`/meals/${analysis.meal.id}`, {}),
      await other.api.delete(`/meals/${analysis.meal.id}`),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MEAL_NOT_FOUND');
    }
  });
});

describe('POST /analyses/:id/dispute', () => {
  it('records the dispute and takes the meal out of the totals until it is corrected', async () => {
    const user = await userWithAutoSave(true);
    const analysis = await analyseWith(app, recognise, user.auth);

    const res = await user.api.post(`/analyses/${analysis.id}/dispute`, {
      reason: 'That was beans, not rice',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.analysis.dispute).toMatchObject({
      reason: 'That was beans, not rice',
      disputedAt: expect.any(String),
    });
    expect(res.body.data.analysis.meal.status).toBe('disputed');

    const corrected = await user.api.patch(`/meals/${analysis.meal.id}`, {});
    expect(corrected.body.data.meal.status).toBe('saved');
  });

  it('works without a reason, and refuses failed analyses', async () => {
    const user = await userWithAutoSave(false);
    const analysis = await analyseWith(app, recognise, user.auth);
    recognise.mockResolvedValueOnce(aiAnswer([]));
    const failed = await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', user.auth)
      .attach('image', await (await import('./images.js')).sharpJpeg(), 'meal.jpg');

    const noReason = await user.api.post(`/analyses/${analysis.id}/dispute`);
    const notCompleted = await user.api.post(
      `/analyses/${failed.body.error.details.analysisId}/dispute`,
    );

    expect(noReason.body.data.analysis).toMatchObject({ dispute: { reason: null }, meal: null });
    expect(notCompleted.status).toBe(409);
  });
});

describe('DELETE /meals/:id', () => {
  it('removes the meal but keeps the analysis, which can be saved again', async () => {
    const user = await userWithAutoSave(true);
    const analysis = await analyseWith(app, recognise, user.auth);

    const res = await user.api.delete(`/meals/${analysis.meal.id}`);

    expect(res.status).toBe(204);
    expect((await user.api.get(`/meals/${analysis.meal.id}`)).status).toBe(404);
    const kept = await user.api.get(`/analyses/${analysis.id}`);
    expect(kept.body.data.analysis).toMatchObject({ status: 'completed', meal: null });
    expect((await user.api.post(`/analyses/${analysis.id}/validate`)).status).toBe(201);
  });
});

describe('GET /meals', () => {
  async function mealOn(user: Awaited<ReturnType<typeof userWithAutoSave>>, mealDate: string) {
    const analysis = await analyseWith(app, recognise, user.auth);
    await user.api.patch(`/meals/${analysis.meal.id}`, { mealDate });
    return analysis.meal.id as string;
  }

  it('lists meals in a date range, newest first, up to the limit', async () => {
    const user = await userWithAutoSave(true);
    const monday = await mealOn(user, '2026-10-12T08:00:00Z');
    const tuesday = await mealOn(user, '2026-10-13T08:00:00Z');
    const wednesday = await mealOn(user, '2026-10-14T08:00:00Z');
    await mealOn(user, '2026-09-01T08:00:00Z');

    const range = await user.api.get('/meals?from=2026-10-12T00:00:00Z&to=2026-10-14T23:59:59Z');
    const limited = await user.api.get(
      '/meals?from=2026-10-12T00:00:00Z&to=2026-10-14T23:59:59Z&limit=2',
    );

    expect(range.body.data.meals.map((m: { id: string }) => m.id)).toEqual([
      wednesday,
      tuesday,
      monday,
    ]);
    expect(range.body.data.meals[0].items).toHaveLength(3);
    expect(limited.body.data.meals).toHaveLength(2);
  });

  it('defaults to the last 30 days', async () => {
    const user = await userWithAutoSave(true);
    const recent = await analyseWith(app, recognise, user.auth);
    await mealOn(user, new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString());

    const res = await user.api.get('/meals');

    expect(res.body.data.meals.map((m: { id: string }) => m.id)).toEqual([recent.meal.id]);
  });

  it('validates the range', async () => {
    const user = await userWithAutoSave(true);
    expect(
      (await user.api.get('/meals?from=2026-10-14T00:00:00Z&to=2026-10-12T00:00:00Z')).status,
    ).toBe(400);
    expect((await user.api.get('/meals?from=yesterday')).status).toBe(400);
  });
});
