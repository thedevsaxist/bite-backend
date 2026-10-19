import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { validate } from '../../middlewares/validate.js';
import { nutritionController } from './nutrition.controller.js';
import { foodIdSchema, searchFoodsSchema } from './nutrition.schemas.js';

// Report §3.4.1 FR 13, 21: seeded nutritional reference data.
export const nutritionRouter = Router();

nutritionRouter.use(requireAuth);

nutritionRouter.get('/foods', validate({ query: searchFoodsSchema }), nutritionController.search);
nutritionRouter.get('/foods/:id', validate({ params: foodIdSchema }), nutritionController.getById);
