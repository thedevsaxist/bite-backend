import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { validate } from '../../middlewares/validate.js';
import { analysesController } from './analyses.controller.js';
import { analysisIdSchema } from './analyses.schemas.js';

// Report §3.5.1, §3.5.4, §3.5.5: food analyses. The stored analysis keeps the original AI result.
// Still to come:
//   POST /analyses                 multipart image + optional context → analysis result   (stage 8)
//   POST /analyses/:id/validate    save the (optionally edited) result as a meal record    (stage 9)
//   POST /analyses/:id/dispute     mark the result as not representing the meal            (stage 9)
export const analysesRouter = Router();

analysesRouter.use(requireAuth);

analysesRouter.get('/:id', validate({ params: analysisIdSchema }), analysesController.getById);
analysesRouter.get(
  '/:id/image',
  validate({ params: analysisIdSchema }),
  analysesController.getImage,
);
