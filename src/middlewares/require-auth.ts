import type { Request, RequestHandler } from 'express';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { usersRepository } from '../modules/users/users.repository.js';
import { AppError } from '../utils/app-error.js';

/**
 * Rejects the request with 401 unless it carries a valid `Authorization: Bearer <accessToken>`
 * header for an account that still exists and is active. Access tokens stay valid until they
 * expire, so the account is checked too: a deleted or suspended account loses access at once.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw AppError.unauthorized('Missing access token');
  }

  const { userId } = await verifyAccessToken(token);
  const user = usersRepository.findById(userId);
  if (!user || user.accountStatus !== 'active') {
    throw new AppError(
      401,
      'This account no longer exists or is not active',
      'ACCOUNT_UNAVAILABLE',
    );
  }
  req.user = { id: userId };
  next();
};

/** The authenticated user. Only call this in handlers that run after `requireAuth`. */
export function authUser(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}
