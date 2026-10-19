import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { validate } from '../../middlewares/validate.js';
import { profileController } from './profile.controller.js';
import { patchProfileSchema, putProfileSchema } from './profile.schemas.js';

// Report §3.4.1 FR 3–4: user profile and daily calorie reference.
export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get('/', profileController.get);
profileRouter.put('/', validate({ body: putProfileSchema }), profileController.put);
profileRouter.patch('/', validate({ body: patchProfileSchema }), profileController.patch);
profileRouter.get('/dietary-reference', profileController.getDietaryReference);
