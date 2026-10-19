import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { validate } from '../../middlewares/validate.js';
import { mealsController } from './meals.controller.js';
import { listMealsSchema, mealChangesSchema, mealIdSchema } from './meals.schemas.js';

// Report §3.4.1 FR 16–18: meal records, i.e. the user's food-intake history.
export const mealsRouter = Router();

mealsRouter.use(requireAuth);

mealsRouter.get('/', validate({ query: listMealsSchema }), mealsController.list);
mealsRouter.get('/:id', validate({ params: mealIdSchema }), mealsController.getById);
mealsRouter.patch(
  '/:id',
  validate({ params: mealIdSchema, body: mealChangesSchema }),
  mealsController.update,
);
mealsRouter.delete('/:id', validate({ params: mealIdSchema }), mealsController.delete);
