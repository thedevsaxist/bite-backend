import { createRemoteJWKSet } from 'jose';
import { env } from '../../../config/env.js';
import { verifyProviderIdToken, type SocialProfile } from './verify-id-token.js';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/** Verifies the `idToken` that the Flutter google_sign_in package returns. */
export async function verifyGoogleIdToken(idToken: string): Promise<SocialProfile> {
  const payload = await verifyProviderIdToken(idToken, {
    providerLabel: 'Google',
    jwks: googleKeys,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: env.GOOGLE_CLIENT_IDS,
  });

  return {
    providerUserId: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : null,
  };
}
