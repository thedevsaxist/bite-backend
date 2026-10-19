import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { foodAnalyses, mealRecords, userProfiles, users } from '../src/db/schema/index.js';
import { signAccessToken } from '../src/modules/auth/tokens.js';
import { usersRepository } from '../src/modules/users/users.repository.js';
import { analyseWith } from './fake-ai.js';

const { recognise } = vi.hoisted(() => ({ recognise: vi.fn() }));
vi.mock('../src/integrations/ai/index.js', () => ({
  foodRecognitionProvider: vi.fn(() => ({ name: 'fake', recognise })),
}));

const app = createApp();
const password = 'correct-horse-battery';

beforeEach(() => {
  recognise.mockReset();
});

/** A user with a profile, a saved meal and a stored photo. */
async function userWithData() {
  const email = `delete-${Date.now()}-${Math.random()}@example.com`;
  const res = await request(app).post('/api/v1/auth/register').send({ email, password });
  const auth = `Bearer ${res.body.data.tokens.accessToken}`;
  const userId: string = res.body.data.user.id;
  await request(app).put('/api/v1/profile').set('Authorization', auth).send({
    age: 30,
    sex: 'female',
    weightKg: 60,
    heightCm: 165,
    activityLevel: 'light',
    weightGoal: 'maintain',
  });
  await analyseWith(app, recognise, auth);
  return { email, auth, userId };
}

const remove = (auth: string, body?: object) => {
  const req = request(app).delete('/api/v1/users/me').set('Authorization', auth);
  return body ? req.send(body) : req;
};

const rowsFor = (userId: string) => ({
  users: db.select().from(users).where(eq(users.id, userId)).all().length,
  profiles: db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).all().length,
  analyses: db.select().from(foodAnalyses).where(eq(foodAnalyses.userId, userId)).all().length,
  meals: db.select().from(mealRecords).where(eq(mealRecords.userId, userId)).all().length,
});

const photoFolder = (userId: string) => path.join(process.env.UPLOAD_DIR!, userId);

describe('DELETE /users/me', () => {
  it('requires authentication', async () => {
    expect((await request(app).delete('/api/v1/users/me')).status).toBe(401);
  });

  it('asks for the password of a password account, and checks it', async () => {
    const { auth, userId } = await userWithData();

    const missing = await remove(auth);
    const wrong = await remove(auth, { password: 'not-my-password' });

    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('PASSWORD_REQUIRED');
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe('INVALID_PASSWORD');
    expect(rowsFor(userId).users).toBe(1);
  });

  it('deletes the account, all its records and its photos', async () => {
    const { email, auth, userId } = await userWithData();
    expect(rowsFor(userId)).toEqual({ users: 1, profiles: 1, analyses: 1, meals: 1 });
    expect(fs.readdirSync(photoFolder(userId))).toHaveLength(1);

    const res = await remove(auth, { password });

    expect(res.status).toBe(204);
    expect(rowsFor(userId)).toEqual({ users: 0, profiles: 0, analyses: 0, meals: 0 });
    expect(fs.readdirSync(photoFolder(userId))).toHaveLength(0);
    // The old access token stops working at once, and the account can't sign in.
    const oldToken = await request(app).get('/api/v1/meals').set('Authorization', auth);
    expect(oldToken.status).toBe(401);
    expect(oldToken.body.error.code).toBe('ACCOUNT_UNAVAILABLE');
    expect((await request(app).post('/api/v1/auth/login').send({ email, password })).status).toBe(
      401,
    );
  });

  it('deletes a Google/Apple-only account without a password', async () => {
    const user = usersRepository.create({ email: `social-${Date.now()}@example.com`, name: 'Ada' });
    const auth = `Bearer ${await signAccessToken(user.id)}`;

    const res = await remove(auth);

    expect(res.status).toBe(204);
    expect(rowsFor(user.id).users).toBe(0);
  });
});
