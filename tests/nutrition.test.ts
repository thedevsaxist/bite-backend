import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { nutritionalReferences } from '../src/db/schema/index.js';
import { nutritionReferenceSeed } from '../src/db/seeds/nutrition-references.js';
import { seedNutritionReferences } from '../src/db/seeds/seed-nutrition.js';
import { signUp } from './helpers.js';

const app = createApp();
let auth: string;

beforeAll(async () => {
  ({ auth } = await signUp(app));
});

const search = (query: Record<string, string | number>) =>
  request(app).get('/api/v1/nutrition/foods').query(query).set('Authorization', auth);

type Food = { key: string; name: string };
const keys = (res: request.Response) => res.body.data.foods.map((f: Food) => f.key);

describe('GET /nutrition/foods', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/nutrition/foods');
    expect(res.status).toBe(401);
  });

  it('finds foods by name, case-insensitively', async () => {
    const res = await search({ q: 'JOLLOF' });

    expect(res.status).toBe(200);
    expect(keys(res)).toContain('jollof_rice');
    expect(res.body.data.foods[0]).toMatchObject({
      name: 'Jollof rice',
      servingSize: 100,
      servingUnit: 'g',
      calories: expect.any(Number),
      typicalServing: { size: 300, label: '1 plate' },
      source: expect.any(String),
    });
  });

  it('finds foods by alias', async () => {
    expect(keys(await search({ q: 'dodo' }))).toEqual(['fried_plantain']);
    expect(keys(await search({ q: 'garri' }))).toContain('eba');
  });

  it('lists names starting with the query first', async () => {
    const res = await search({ q: 'rice' });
    const names: string[] = res.body.data.foods.map((f: Food) => f.name);
    const firstNonPrefix = names.findIndex((name) => !name.toLowerCase().startsWith('rice'));
    const lastPrefix = names.findLastIndex((name) => name.toLowerCase().startsWith('rice'));

    expect(keys(res)).toEqual(expect.arrayContaining(['jollof_rice', 'white_rice_cooked']));
    expect(lastPrefix).toBeLessThan(firstNonPrefix === -1 ? Infinity : firstNonPrefix);
  });

  it('treats LIKE wildcards as plain text', async () => {
    expect(keys(await search({ q: '%' }))).toEqual([]);
    expect(keys(await search({ q: '_' }))).toEqual([]);
  });

  it('lists all foods alphabetically without a query, up to the limit', async () => {
    const res = await search({ limit: 5 });
    const names: string[] = res.body.data.foods.map((f: Food) => f.name);

    expect(names).toHaveLength(5);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('validates the limit', async () => {
    expect((await search({ limit: 0 })).status).toBe(400);
    expect((await search({ limit: 101 })).status).toBe(400);
    expect((await search({ limit: 'many' })).status).toBe(400);
  });
});

describe('GET /nutrition/foods/:id', () => {
  it('returns one food', async () => {
    const found = await search({ q: 'egusi' });
    const id = found.body.data.foods[0].id;

    const res = await request(app).get(`/api/v1/nutrition/foods/${id}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.food).toMatchObject({ id, key: 'egusi_soup' });
  });

  it('returns FOOD_NOT_FOUND for an unknown id', async () => {
    const res = await request(app)
      .get('/api/v1/nutrition/foods/does-not-exist')
      .set('Authorization', auth);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FOOD_NOT_FOUND');
  });
});

describe('seed data', () => {
  it('has unique keys', () => {
    const all = nutritionReferenceSeed.map((f) => f.key);
    expect(new Set(all).size).toBe(all.length);
  });

  it('has calories consistent with the macronutrients (4/4/9 kcal per g, within 25%)', () => {
    for (const food of nutritionReferenceSeed) {
      const fromMacros = 4 * food.protein + 4 * food.carbohydrates + 9 * food.fat;
      const ratio = fromMacros / food.calories;
      expect(ratio, food.key).toBeGreaterThan(0.75);
      expect(ratio, food.key).toBeLessThan(1.25);
    }
  });

  it('can be re-run: updates existing rows without duplicating them', () => {
    const before = db.select().from(nutritionalReferences).all();
    const jollof = before.find((f) => f.key === 'jollof_rice')!;
    db.update(nutritionalReferences)
      .set({ calories: 1 })
      .where(eq(nutritionalReferences.key, 'jollof_rice'))
      .run();

    seedNutritionReferences();

    const after = db.select().from(nutritionalReferences).all();
    const jollofAfter = after.find((f) => f.key === 'jollof_rice')!;
    expect(after).toHaveLength(before.length);
    expect(jollofAfter.id).toBe(jollof.id);
    expect(jollofAfter.calories).toBe(jollof.calories);
  });
});
