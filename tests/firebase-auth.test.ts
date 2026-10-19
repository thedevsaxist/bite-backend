import type * as Jose from 'jose';
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JSONWebKeySet,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const projectId = 'calorie-app-test';

// Set before env.ts loads (vi.hoisted runs ahead of the imports below).
vi.hoisted(() => {
  process.env.FIREBASE_PROJECT_ID = 'calorie-app-test';
});

// Firebase's real signing keys can't sign test tokens, so the remote key set is swapped for a
// local one holding a key generated here. Everything else in the verifier runs for real.
const keys = vi.hoisted(() => ({ jwks: { keys: [] as object[] } }));
vi.mock('jose', async (importOriginal) => {
  const jose = await importOriginal<typeof Jose>();
  // Built on each call: the key set is only filled in beforeAll, after the verifier module loads.
  const getKey: JWTVerifyGetKey = (header, token) =>
    jose.createLocalJWKSet(keys.jwks as JSONWebKeySet)(header, token);
  return { ...jose, createRemoteJWKSet: () => getKey };
});

const { createApp } = await import('../src/app.js');
const app = createApp();

let privateKey: CryptoKey;
let otherKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair('RS256')).privateKey;
  keys.jwks.keys = [{ ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'RS256' }];
});

let counter = 0;

function googleClaims(overrides: JWTPayload = {}): JWTPayload {
  const googleSub = `google-sub-${++counter}`;
  const email = `firebase${counter}@example.com`;
  return {
    email,
    email_verified: true,
    name: 'Grace',
    auth_time: Math.floor(Date.now() / 1000) - 5,
    firebase: {
      sign_in_provider: 'google.com',
      identities: { 'google.com': [googleSub], email: [email] },
    },
    ...overrides,
  };
}

function signToken(
  claims: JWTPayload,
  {
    audience = projectId,
    issuer = `https://securetoken.google.com/${projectId}`,
    key = privateKey,
  } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject(`firebase-uid-${counter}`)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}

const signIn = (body: object) => request(app).post('/api/v1/auth/firebase').send(body);

describe('POST /auth/firebase', () => {
  it('creates an account on first Google sign-in, then reuses it', async () => {
    const claims = googleClaims();
    const token = await signToken(claims);

    const first = await signIn({ idToken: token });
    const second = await signIn({ idToken: token });

    expect(first.status).toBe(200);
    expect(first.body.data.isNewUser).toBe(true);
    expect(first.body.data.user).toMatchObject({
      email: claims.email,
      name: 'Grace',
      hasPassword: false,
    });
    expect(first.body.data.tokens).toMatchObject({ tokenType: 'Bearer' });
    expect(second.body.data.isNewUser).toBe(false);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
  });

  it('links to an existing password account with the same email', async () => {
    const claims = googleClaims();
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: claims.email, password: 'correct-horse-battery' });

    const res = await signIn({ idToken: await signToken(claims) });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(registered.body.data.user.id);
  });

  it('uses the name from the body when the token has none (Apple)', async () => {
    const claims = googleClaims({
      email: 'relay@privaterelay.appleid.com',
      name: undefined,
      firebase: { sign_in_provider: 'apple.com', identities: { 'apple.com': ['apple-sub-1'] } },
    });

    const res = await signIn({ idToken: await signToken(claims), name: 'Tim' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Tim');
  });

  it('rejects tokens for another project, from another issuer or signed with another key', async () => {
    const claims = googleClaims();
    const tokens = await Promise.all([
      signToken(claims, { audience: 'someone-elses-project' }),
      signToken(claims, { issuer: 'https://securetoken.google.com/someone-elses-project' }),
      signToken(claims, { key: otherKey }),
    ]);

    for (const idToken of tokens) {
      const res = await signIn({ idToken });
      expect(res.status).toBe(401);
    }
  });

  it('rejects a token whose sign-in time is in the future', async () => {
    const claims = googleClaims({ auth_time: Math.floor(Date.now() / 1000) + 3600 });

    const res = await signIn({ idToken: await signToken(claims) });

    expect(res.status).toBe(401);
  });

  it('refuses Firebase sign-in methods other than Google and Apple', async () => {
    const claims = googleClaims({
      firebase: { sign_in_provider: 'anonymous', identities: {} },
    });

    const res = await signIn({ idToken: await signToken(claims) });

    expect(res.status).toBe(400);
  });

  it('refuses an unverified email', async () => {
    const res = await signIn({ idToken: await signToken(googleClaims({ email_verified: false })) });

    expect(res.status).toBe(400);
  });

  it('validates the body', async () => {
    const res = await signIn({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
