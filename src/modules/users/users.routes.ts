import { Router } from 'express';
import { authRateLimiter } from '../../middlewares/rate-limit.js';
import { requireAuth } from '../../middlewares/require-auth.js';
import { validate } from '../../middlewares/validate.js';
import { usersController } from './users.controller.js';
import { deleteAccountSchema } from './users.schemas.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, usersController.getMe);
// Body: { password } for accounts that have one. Rate limited like sign-in, as it checks a password.
usersRouter.delete(
  '/me',
  requireAuth,
  authRateLimiter,
  validate({ body: deleteAccountSchema }),
  usersController.deleteMe,
);
