import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import type {
  AppleSignInInput,
  FirebaseSignInInput,
  GoogleSignInInput,
  LoginInput,
  RefreshTokenInput,
  RegisterInput,
} from './auth.schemas.js';
import { authService } from './auth.service.js';
import { verifyAppleIdToken } from './social/apple.js';
import { verifyFirebaseIdToken } from './social/firebase.js';
import { verifyGoogleIdToken } from './social/google.js';

// Request bodies are already validated and typed by the validate() middleware on each route.

export const authController = {
  async register(req: Request, res: Response) {
    sendSuccess(res, await authService.register(req.body as RegisterInput), 201);
  },

  async login(req: Request, res: Response) {
    sendSuccess(res, await authService.login(req.body as LoginInput));
  },

  async google(req: Request, res: Response) {
    const { idToken } = req.body as GoogleSignInInput;
    const profile = await verifyGoogleIdToken(idToken);
    sendSuccess(res, await authService.socialSignIn('google', profile));
  },

  async apple(req: Request, res: Response) {
    const { idToken, nonce, name } = req.body as AppleSignInInput;
    const profile = await verifyAppleIdToken(idToken, nonce);
    sendSuccess(res, await authService.socialSignIn('apple', { ...profile, name: name ?? null }));
  },

  async firebase(req: Request, res: Response) {
    const { idToken, name } = req.body as FirebaseSignInInput;
    const { provider, ...profile } = await verifyFirebaseIdToken(idToken);
    sendSuccess(
      res,
      await authService.socialSignIn(provider, { ...profile, name: profile.name ?? name ?? null }),
    );
  },

  async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body as RefreshTokenInput;
    sendSuccess(res, await authService.refresh(refreshToken));
  },

  logout(req: Request, res: Response) {
    const { refreshToken } = req.body as RefreshTokenInput;
    authService.logout(refreshToken);
    res.status(204).end();
  },
};
