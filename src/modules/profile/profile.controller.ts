import type { Request, Response } from 'express';
import { authUser } from '../../middlewares/require-auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import type { PatchProfileInput, PutProfileInput } from './profile.schemas.js';
import { profileService } from './profile.service.js';

export const profileController = {
  get(req: Request, res: Response) {
    sendSuccess(res, profileService.get(authUser(req).id));
  },

  put(req: Request, res: Response) {
    sendSuccess(res, profileService.put(authUser(req).id, req.body as PutProfileInput));
  },

  patch(req: Request, res: Response) {
    sendSuccess(res, profileService.patch(authUser(req).id, req.body as PatchProfileInput));
  },

  getDietaryReference(req: Request, res: Response) {
    sendSuccess(res, profileService.getDietaryReference(authUser(req).id));
  },
};
