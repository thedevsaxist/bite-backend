import request from 'supertest';
import type { App } from 'supertest/types.js';

let counter = 0;

/** Registers a fresh user and returns their access token, ready for an Authorization header. */
export async function signUp(app: App) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: `helper${++counter}-${Date.now()}@example.com`,
      password: 'correct-horse-battery',
    });
  return {
    auth: `Bearer ${res.body.data.tokens.accessToken as string}`,
    userId: res.body.data.user.id,
  };
}
