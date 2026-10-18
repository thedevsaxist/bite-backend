import { createHash } from 'node:crypto';
import { createRemoteJWKSet } from 'jose';
import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/app-error.js';
import { verifyProviderIdToken, type SocialProfile } from './verify-id-token.js';

const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

/**
 * Verifies the `identityToken` that the Flutter sign_in_with_apple package returns.
 *
 * If the app passed `sha256(rawNonce)` as the nonce when starting Sign in with Apple, send the raw
 * nonce here: it proves the token was issued for this sign-in attempt and wasn't replayed.
 * Apple never puts the user's name in the token; the app receives it once, on first sign-in only.
 */
export async function verifyAppleIdToken(
  idToken: string,
  rawNonce?: string,
): Promise<SocialProfile> {
  const payload = await verifyProviderIdToken(idToken, {
    providerLabel: 'Apple',
    jwks: appleKeys,
    issuer: 'https://appleid.apple.com',
    audience: env.APPLE_CLIENT_IDS,
  });

  if (rawNonce !== undefined) {
    const expected = createHash('sha256').update(rawNonce).digest('hex');
    if (payload.nonce !== expected) throw AppError.unauthorized('Apple ID token nonce mismatch');
  }

  return {
    providerUserId: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    // Apple sends this as either a boolean or the string "true".
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    name: null,
  };
}
