import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import type { FoodIdParams, SearchFoodsQuery } from './nutrition.schemas.js';
import { nutritionService } from './nutrition.service.js';

export const nutritionController = {
  search(req: Request, res: Response) {
    sendSuccess(res, nutritionService.search(req.query as unknown as SearchFoodsQuery));
  },

  getById(req: Request, res: Response) {
    sendSuccess(res, nutritionService.getById((req.params as FoodIdParams).id));
  },
};
