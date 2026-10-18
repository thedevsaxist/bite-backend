import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { verifyAppleIdToken } from '../src/modules/auth/social/apple.js';
import { verifyGoogleIdToken } from '../src/modules/auth/social/google.js';

// Real Google/Apple tokens can't be produced in tests, so the verifiers are replaced with fakes.
vi.mock('../src/modules/auth/social/google.js', () => ({ verifyGoogleIdToken: vi.fn() }));
vi.mock('../src/modules/auth/social/apple.js', () => ({ verifyAppleIdToken: vi.fn() }));

const app = createApp();
const password = 'correct-horse-battery';
let emailCounter = 0;
const uniqueEmail = () => `user${++emailCounter}@example.com`;

function register(email = uniqueEmail(), name = 'Ada') {
  return request(app).post('/api/v1/auth/register').send({ email, password, name });
}

describe('POST /auth/register', () => {
  it('creates an account and signs the user in', async () => {
    const res = await register('  New.User@Example.com ');

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: 'new.user@example.com', name: 'Ada' });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.isNewUser).toBe(true);
    expect(res.body.data.tokens).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
  });

  it('rejects a duplicate email', async () => {
    const email = uniqueEmail();
    await register(email);
    const res = await register(email.toUpperCase());

    expect(res.status).toBe(409);
  });

  it('validates the body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual([
      'email',
      'password',
    ]);
  });
});

describe('POST /auth/login', () => {
  it('signs in with the right password', async () => {
    const email = uniqueEmail();
    await register(email);
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.data.isNewUser).toBe(false);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const email = uniqueEmail();
    await register(email);
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });
});

describe('GET /users/me', () => {
  it('returns the signed-in user', async () => {
    const { body } = await register();
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${body.data.tokens.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(body.data.user.id);
  });

  it('rejects missing or invalid tokens', async () => {
    const missing = await request(app).get('/api/v1/users/me');
    const invalid = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer not-a-jwt');

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });
});

describe('refresh and logout', () => {
  it('rotates the refresh token', async () => {
    const { body } = await register();
    const first = body.data.tokens.refreshToken;

    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens.refreshToken).not.toBe(first);
    expect(res.body.data.tokens.accessToken).toEqual(expect.any(String));
  });

  it('revokes every session when an old refresh token is reused', async () => {
    const { body } = await register();
    const first = body.data.tokens.refreshToken;
    const rotated = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    const second = rotated.body.data.tokens.refreshToken;

    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('INVALID_REFRESH_TOKEN');

    // The legitimate latest token is revoked too, forcing a fresh sign-in.
    const afterReuse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: second });
    expect(afterReuse.status).toBe(401);
  });

  it('logout invalidates the refresh token', async () => {
    const { body } = await register();
    const { refreshToken } = body.data.tokens;

    const logout = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
    expect(logout.status).toBe(204);

    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });
});

describe('social sign-in', () => {
  const googleProfile = (overrides = {}) => ({
    providerUserId: `google-${++emailCounter}`,
    email: uniqueEmail(),
    emailVerified: true,
    name: 'Grace',
    ...overrides,
  });

  beforeEach(() => vi.mocked(verifyGoogleIdToken).mockReset());

  it('creates an account on first Google sign-in, then reuses it', async () => {
    const profile = googleProfile();
    vi.mocked(verifyGoogleIdToken).mockResolvedValue(profile);

    const first = await request(app).post('/api/v1/auth/google').send({ idToken: 'token' });
    const second = await request(app).post('/api/v1/auth/google').send({ idToken: 'token' });

    expect(first.status).toBe(200);
    expect(first.body.data.isNewUser).toBe(true);
    expect(first.body.data.user).toMatchObject({ email: profile.email, hasPassword: false });
    expect(second.body.data.isNewUser).toBe(false);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
  });

  it('links Google to an existing password account with the same email', async () => {
    const email = uniqueEmail();
    const registered = await register(email);
    vi.mocked(verifyGoogleIdToken).mockResolvedValue(googleProfile({ email }));

    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'token' });

    expect(res.body.data.user.id).toBe(registered.body.data.user.id);
    expect(res.body.data.isNewUser).toBe(false);
  });

  it('refuses an unverified email', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue(googleProfile({ emailVerified: false }));

    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'token' });

    expect(res.status).toBe(400);
  });

  it('uses the name the app sends for Apple sign-in', async () => {
    vi.mocked(verifyAppleIdToken).mockResolvedValue({
      providerUserId: 'apple-1',
      email: 'relay@privaterelay.appleid.com',
      emailVerified: true,
      name: null,
    });

    const res = await request(app)
      .post('/api/v1/auth/apple')
      .send({ idToken: 'token', nonce: 'raw-nonce', name: 'Tim' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Tim');
    expect(verifyAppleIdToken).toHaveBeenCalledWith('token', 'raw-nonce');
  });
});
