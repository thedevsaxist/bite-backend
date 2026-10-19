import type { Request, Response } from 'express';
import { authUser } from '../../middlewares/require-auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import type { PatchSettingsInput } from './settings.schemas.js';
import { settingsService } from './settings.service.js';

export const settingsController = {
  get(req: Request, res: Response) {
    sendSuccess(res, settingsService.get(authUser(req).id));
  },

  patch(req: Request, res: Response) {
    sendSuccess(res, settingsService.patch(authUser(req).id, req.body as PatchSettingsInput));
  },
};
