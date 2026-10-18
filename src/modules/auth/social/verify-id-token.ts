import { errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { AppError } from '../../../utils/app-error.js';

/** What the auth service needs from a verified Google/Apple ID token. */
export type SocialProfile = {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

type VerifyOptions = {
  providerLabel: string;
  jwks: JWTVerifyGetKey;
  issuer: string | string[];
  audience: string[];
};

/**
 * Verifies an ID token issued by an OpenID Connect provider: signature (against the provider's
 * published keys), issuer, audience (our client IDs) and expiry.
 */
export async function verifyProviderIdToken(
  idToken: string,
  { providerLabel, jwks, issuer, audience }: VerifyOptions,
): Promise<JWTPayload & { sub: string }> {
  if (audience.length === 0) {
    throw new AppError(
      503,
      `${providerLabel} sign-in is not configured`,
      'PROVIDER_NOT_CONFIGURED',
    );
  }

  try {
    const { payload } = await jwtVerify(idToken, jwks, { issuer, audience });
    if (!payload.sub) throw new errors.JWTInvalid('Token has no subject');
    return { ...payload, sub: payload.sub };
  } catch (err) {
    // Anything that isn't a token problem (network failure, key fetch timeout) is on our side.
    if (!(err instanceof errors.JOSEError) || err instanceof errors.JWKSTimeout) {
      throw new AppError(
        503,
        `Could not reach ${providerLabel} to verify sign-in`,
        'PROVIDER_UNAVAILABLE',
      );
    }
    throw AppError.unauthorized(`Invalid ${providerLabel} ID token`);
  }
}
