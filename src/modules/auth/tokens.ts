import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, errors, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';

const ISSUER = 'calorie-estimation-api';
const AUDIENCE = 'calorie-estimation-app';
const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export const accessTokenTtlSeconds = env.ACCESS_TOKEN_TTL_MINUTES * 60;
export const refreshTokenTtlMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Short-lived, stateless JWT sent on every request as `Authorization: Bearer <token>`. */
export function signAccessToken(userId: string) {
  return new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(accessSecret);
}

export async function verifyAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, accessSecret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (!payload.sub) throw new Error('Token has no subject');
    return { userId: payload.sub };
  } catch (err) {
    // A distinct code lets the app know it should refresh rather than log the user out.
    if (err instanceof errors.JWTExpired) {
      throw new AppError(401, 'Access token expired', 'TOKEN_EXPIRED');
    }
    throw AppError.unauthorized('Invalid access token');
  }
}

/** Long-lived opaque token used only to obtain new access tokens. */
export function generateRefreshToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
