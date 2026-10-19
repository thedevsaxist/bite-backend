import { createRemoteJWKSet } from 'jose';
import { env } from '../../../config/env.js';
import type { AuthProvider } from '../../../db/schema/index.js';
import { AppError } from '../../../utils/app-error.js';
import { verifyProviderIdToken, type SocialProfile } from './verify-id-token.js';

const firebaseKeys = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

// Firebase sign-in methods we accept, mapped to our providers. Email/password, phone and anonymous
// Firebase accounts are refused: the app uses our own /auth/register and /auth/login for those.
const firebaseProviders: Record<string, AuthProvider> = {
  'google.com': 'google',
  'apple.com': 'apple',
};

type FirebaseClaim = {
  sign_in_provider?: string;
  identities?: Record<string, unknown>;
};

/**
 * Verifies the ID token from `FirebaseAuth.instance.currentUser.getIdToken()` in the Flutter app.
 *
 * The identity is stored under the underlying provider's own user ID (Google's/Apple's `sub`, not
 * the Firebase UID), so it matches accounts already linked through /auth/google or /auth/apple.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<SocialProfile & { provider: AuthProvider }> {
  const projectId = env.FIREBASE_PROJECT_ID;
  const payload = await verifyProviderIdToken(idToken, {
    providerLabel: 'Firebase',
    jwks: firebaseKeys,
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId ? [projectId] : [],
  });

  // Firebase requires the sign-in time to be in the past; jose only checks exp/iat.
  if (typeof payload.auth_time !== 'number' || payload.auth_time > Date.now() / 1000 + 60) {
    throw AppError.unauthorized('Invalid Firebase ID token');
  }

  const firebase = (payload.firebase ?? {}) as FirebaseClaim;
  const signInProvider = firebase.sign_in_provider ?? '';
  const provider = firebaseProviders[signInProvider];
  if (!provider) {
    throw AppError.badRequest(
      `Signing in with "${signInProvider}" through Firebase is not supported`,
    );
  }

  const providerIds = firebase.identities?.[signInProvider];
  const providerUserId = Array.isArray(providerIds) ? providerIds[0] : undefined;
  if (typeof providerUserId !== 'string' || !providerUserId) {
    throw AppError.unauthorized('Firebase ID token has no provider identity');
  }

  return {
    provider,
    providerUserId,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : null,
  };
}
