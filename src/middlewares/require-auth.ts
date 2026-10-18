import type { Request, RequestHandler } from 'express';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { AppError } from '../utils/app-error.js';

/** Rejects the request with 401 unless it carries a valid `Authorization: Bearer <accessToken>` header. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw AppError.unauthorized('Missing access token');
  }

  const { userId } = await verifyAccessToken(token);
  req.user = { id: userId };
  next();
};

/** The authenticated user. Only call this in handlers that run after `requireAuth`. */
export function authUser(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}
