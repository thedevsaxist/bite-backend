import type { Request, Response } from 'express';
import { authUser } from '../../middlewares/require-auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import type { ListMealsQuery, MealChanges, MealIdParams } from './meals.schemas.js';
import { mealsService } from './meals.service.js';

export const mealsController = {
  list(req: Request, res: Response) {
    sendSuccess(res, mealsService.list(authUser(req).id, req.query as unknown as ListMealsQuery));
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params as MealIdParams;
    sendSuccess(res, await mealsService.get(authUser(req).id, id));
  },

  async update(req: Request, res: Response) {
    const { id } = req.params as MealIdParams;
    sendSuccess(res, await mealsService.update(authUser(req).id, id, req.body as MealChanges));
  },

  delete(req: Request, res: Response) {
    const { id } = req.params as MealIdParams;
    mealsService.delete(authUser(req).id, id);
    res.status(204).end();
  },
};
