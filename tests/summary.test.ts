import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { datesBetween, daysBetween, localDate } from '../src/modules/summary/local-dates.js';
import { analyseWith } from './fake-ai.js';
import { signUp } from './helpers.js';

const { recognise } = vi.hoisted(() => ({ recognise: vi.fn() }));
vi.mock('../src/integrations/ai/index.js', () => ({
  foodRecognitionProvider: vi.fn(() => ({ name: 'fake', recognise })),
}));

const app = createApp();

// A fixed "now" (13:00 in Lagos) so day boundaries don't depend on when the tests run.
// Only Date is faked; timers stay real so requests still complete.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
});
beforeEach(() => {
  recognise.mockReset();
});

// Male, 30, 80 kg, 180 cm, moderately active, maintaining: 2759 kcal a day.
const profile = {
  age: 30,
  sex: 'male',
  weightKg: 80,
  heightCm: 180,
  activityLevel: 'moderate',
  weightGoal: 'maintain',
};

async function userWithMeals(mealDates: string[], { withProfile = true } = {}) {
  const { auth } = await signUp(app);
  if (withProfile)
    await request(app).put('/api/v1/profile').set('Authorization', auth).send(profile);
  const mealIds: string[] = [];
  for (const mealDate of mealDates) {
    // Each analysis is the 900 kcal jollof, plantain and zobo meal.
    const analysis = await analyseWith(app, recognise, auth);
    await request(app)
      .patch(`/api/v1/meals/${analysis.meal.id}`)
      .set('Authorization', auth)
      .send({ mealDate });
    mealIds.push(analysis.meal.id);
  }
  return { auth, mealIds };
}

const get = (auth: string, path: string) =>
  request(app).get(`/api/v1${path}`).set('Authorization', auth);

describe('local dates', () => {
  it('uses the calendar day in the given timezone', () => {
    // 23:30 UTC is already 00:30 the next day in Lagos (UTC+1).
    expect(localDate(new Date('2026-10-14T23:30:00Z'), 'Africa/Lagos')).toBe('2026-10-15');
    expect(localDate(new Date('2026-10-14T23:30:00Z'), 'UTC')).toBe('2026-10-14');
  });

  it('lists and counts the days in a range', () => {
    expect(datesBetween('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(daysBetween('2026-10-01', '2026-10-15')).toBe(14);
  });
});

describe('GET /summary/daily', () => {
  it("compares the day's intake with the daily calorie reference", async () => {
    const { auth } = await userWithMeals([
      '2026-10-15T07:00:00Z', // breakfast
      '2026-10-15T18:30:00Z', // dinner
      '2026-10-14T23:30:00Z', // 00:30 on the 15th in Lagos
      '2026-10-14T12:00:00Z', // the day before
    ]);

    const res = await get(auth, '/summary/daily?date=2026-10-15');

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({
      timezone: 'Africa/Lagos',
      date: '2026-10-15',
      totals: { calories: 2700, protein: 33, carbohydrates: 423, fat: 99 },
      mealCount: 3,
      dailyCalorieReference: 2759,
      remainingCalories: 59,
      percentOfReference: 98,
    });
  });

  it('groups by the timezone it is given', async () => {
    const { auth } = await userWithMeals(['2026-10-15T07:00:00Z', '2026-10-14T23:30:00Z']);

    const utc = await get(auth, '/summary/daily?date=2026-10-15&timezone=UTC');

    expect(utc.body.data.summary).toMatchObject({
      timezone: 'UTC',
      mealCount: 1,
      totals: { calories: 900 },
    });
  });

  it('leaves out disputed meals', async () => {
    const { auth } = await userWithMeals(['2026-10-15T07:00:00Z', '2026-10-15T12:00:00Z']);
    const meals = await get(auth, '/meals?from=2026-10-15T00:00:00Z&to=2026-10-15T23:00:00Z');
    await request(app)
      .post(`/api/v1/analyses/${meals.body.data.meals[0].analysisId}/dispute`)
      .set('Authorization', auth)
      .send({});

    const res = await get(auth, '/summary/daily?date=2026-10-15');

    expect(res.body.data.summary).toMatchObject({ mealCount: 1, totals: { calories: 900 } });
  });

  it('has no reference before the profile was set up, or without a profile', async () => {
    const withProfile = await userWithMeals(['2026-10-10T12:00:00Z']);
    const withoutProfile = await userWithMeals(['2026-10-15T12:00:00Z'], { withProfile: false });

    const beforeProfile = await get(withProfile.auth, '/summary/daily?date=2026-10-10');
    const noProfile = await get(withoutProfile.auth, '/summary/daily?date=2026-10-15');

    for (const res of [beforeProfile, noProfile]) {
      expect(res.body.data.summary).toMatchObject({
        mealCount: 1,
        dailyCalorieReference: null,
        remainingCalories: null,
        percentOfReference: null,
      });
    }
  });

  it('validates the date and timezone', async () => {
    const { auth } = await signUp(app);
    expect((await get(auth, '/summary/daily')).status).toBe(400);
    expect((await get(auth, '/summary/daily?date=15-10-2026')).status).toBe(400);
    expect((await get(auth, '/summary/daily?date=2026-10-15&timezone=Mars/Olympus')).status).toBe(
      400,
    );
  });
});

describe('GET /summary', () => {
  it('gives every day in the range, with totals and averages over the logged days', async () => {
    const { auth } = await userWithMeals([
      '2026-10-13T12:00:00Z',
      '2026-10-15T07:00:00Z',
      '2026-10-15T18:00:00Z',
    ]);

    const res = await get(auth, '/summary?from=2026-10-12&to=2026-10-15');

    const summary = res.body.data.summary;
    expect(
      summary.days.map((d: { date: string; mealCount: number }) => [d.date, d.mealCount]),
    ).toEqual([
      ['2026-10-12', 0],
      ['2026-10-13', 1],
      ['2026-10-14', 0],
      ['2026-10-15', 2],
    ]);
    expect(summary.days[0].totals).toEqual({ calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
    expect(summary).toMatchObject({
      from: '2026-10-12',
      to: '2026-10-15',
      timezone: 'Africa/Lagos',
      loggedDays: 2,
      totals: { calories: 2700 },
      averagePerLoggedDay: { calories: 1350, protein: 16.5, carbohydrates: 211.5, fat: 49.5 },
    });
    // The profile was set up on the 15th, so only that day has a reference.
    expect(
      summary.days.map((d: { dailyCalorieReference: number | null }) => d.dailyCalorieReference),
    ).toEqual([null, null, null, 2759]);
  });

  it('limits the range to 92 days, in order', async () => {
    const { auth } = await signUp(app);
    expect((await get(auth, '/summary?from=2026-07-16&to=2026-10-15')).status).toBe(200);
    expect((await get(auth, '/summary?from=2026-07-15&to=2026-10-15')).status).toBe(400);
    expect((await get(auth, '/summary?from=2026-10-15&to=2026-10-14')).status).toBe(400);
  });
});
