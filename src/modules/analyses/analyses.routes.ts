import { Router } from 'express';
import { analysisRateLimiter } from '../../middlewares/rate-limit.js';
import { requireAuth } from '../../middlewares/require-auth.js';
import { validate } from '../../middlewares/validate.js';
import { analysesController } from './analyses.controller.js';
import { mealChangesSchema } from '../meals/meals.schemas.js';
import {
  analysisIdSchema,
  createAnalysisSchema,
  disputeAnalysisSchema,
} from './analyses.schemas.js';
import { uploadMealImage } from './image-upload.js';

// Report §3.5.1, §3.5.4, §3.5.5: food analyses. The stored analysis keeps the original AI result.
export const analysesRouter = Router();

analysesRouter.use(requireAuth);

// multipart/form-data: "image" (the photo) and optional "context" (meal notes).
analysesRouter.post(
  '/',
  analysisRateLimiter,
  uploadMealImage,
  validate({ body: createAnalysisSchema }),
  analysesController.create,
);

analysesRouter.get('/:id', validate({ params: analysisIdSchema }), analysesController.getById);
analysesRouter.get(
  '/:id/image',
  validate({ params: analysisIdSchema }),
  analysesController.getImage,
);
analysesRouter.post(
  '/:id/validate',
  validate({ params: analysisIdSchema, body: mealChangesSchema }),
  analysesController.validate,
);
analysesRouter.post(
  '/:id/dispute',
  validate({ params: analysisIdSchema, body: disputeAnalysisSchema }),
  analysesController.dispute,
);
