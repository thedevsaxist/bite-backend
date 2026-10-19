import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { signUp } from './helpers.js';

const app = createApp();

const profile = {
  age: 30,
  sex: 'male',
  weightKg: 80,
  heightCm: 180,
  activityLevel: 'moderate',
  weightGoal: 'maintain',
};

describe('profile', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/profile');
    expect(res.status).toBe(401);
  });

  it('returns PROFILE_NOT_FOUND before the profile is set up', async () => {
    const { auth } = await signUp(app);

    const profileRes = await request(app).get('/api/v1/profile').set('Authorization', auth);
    const referenceRes = await request(app)
      .get('/api/v1/profile/dietary-reference')
      .set('Authorization', auth);
    const patchRes = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', auth)
      .send({ weightKg: 75 });

    for (const res of [profileRes, referenceRes, patchRes]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROFILE_NOT_FOUND');
    }
  });

  it('creates the profile and calculates the daily calorie reference', async () => {
    const { auth } = await signUp(app);

    const res = await request(app).put('/api/v1/profile').set('Authorization', auth).send(profile);

    expect(res.status).toBe(200);
    expect(res.body.data.profile).toMatchObject(profile);
    expect(res.body.data.dietaryReference).toMatchObject({
      bmr: 1780,
      maintenanceCalories: 2759,
      dailyCalorieReference: 2759,
    });

    const fetched = await request(app).get('/api/v1/profile').set('Authorization', auth);
    expect(fetched.body.data.profile).toMatchObject(profile);
  });

  it('updates part of the profile and recalculates the reference', async () => {
    const { auth } = await signUp(app);
    await request(app).put('/api/v1/profile').set('Authorization', auth).send(profile);

    const res = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', auth)
      .send({ weightGoal: 'lose' });

    expect(res.status).toBe(200);
    expect(res.body.data.profile).toMatchObject({ ...profile, weightGoal: 'lose' });
    expect(res.body.data.dietaryReference.dailyCalorieReference).toBe(2259);

    const latest = await request(app)
      .get('/api/v1/profile/dietary-reference')
      .set('Authorization', auth);
    expect(latest.body.data.dietaryReference.dailyCalorieReference).toBe(2259);
  });

  it('keeps the existing reference when the result does not change', async () => {
    const { auth } = await signUp(app);
    const first = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', auth)
      .send(profile);
    const second = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', auth)
      .send(profile);

    expect(second.body.data.dietaryReference.calculatedAt).toBe(
      first.body.data.dietaryReference.calculatedAt,
    );
  });

  it("keeps each user's profile separate", async () => {
    const a = await signUp(app);
    const b = await signUp(app);
    await request(app).put('/api/v1/profile').set('Authorization', a.auth).send(profile);

    const res = await request(app).get('/api/v1/profile').set('Authorization', b.auth);
    expect(res.status).toBe(404);
  });

  it('validates the body', async () => {
    const { auth } = await signUp(app);

    const invalid = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', auth)
      .send({ ...profile, age: 12, sex: 'other', extra: true });
    const missing = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', auth)
      .send({ age: 30 });
    const emptyPatch = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', auth)
      .send({});

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['age', 'sex']),
    );
    expect(missing.status).toBe(400);
    expect(emptyPatch.status).toBe(400);
  });
});
