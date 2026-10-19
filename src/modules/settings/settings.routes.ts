import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { validate } from '../../middlewares/validate.js';
import { settingsController } from './settings.controller.js';
import { patchSettingsSchema } from './settings.schemas.js';

// Report §3.5.3 "User Settings": per-user app preferences.
export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get('/', settingsController.get);
settingsRouter.patch('/', validate({ body: patchSettingsSchema }), settingsController.patch);
