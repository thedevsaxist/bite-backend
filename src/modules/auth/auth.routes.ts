import { Router } from 'express';
import { authRateLimiter } from '../../middlewares/rate-limit.js';
import { validate } from '../../middlewares/validate.js';
import { authController } from './auth.controller.js';
import {
  appleSignInSchema,
  firebaseSignInSchema,
  googleSignInSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from './auth.schemas.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema }),
  authController.register,
);
authRouter.post('/login', authRateLimiter, validate({ body: loginSchema }), authController.login);
authRouter.post(
  '/google',
  authRateLimiter,
  validate({ body: googleSignInSchema }),
  authController.google,
);
authRouter.post(
  '/apple',
  authRateLimiter,
  validate({ body: appleSignInSchema }),
  authController.apple,
);
authRouter.post(
  '/firebase',
  authRateLimiter,
  validate({ body: firebaseSignInSchema }),
  authController.firebase,
);
authRouter.post('/refresh', validate({ body: refreshTokenSchema }), authController.refresh);
authRouter.post('/logout', validate({ body: refreshTokenSchema }), authController.logout);
