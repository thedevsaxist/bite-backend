import type { Request, Response } from 'express';
import { authUser } from '../../middlewares/require-auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import type { AnalysisIdParams } from './analyses.schemas.js';
import { analysesService } from './analyses.service.js';

export const analysesController = {
  async getById(req: Request, res: Response) {
    const { id } = req.params as AnalysisIdParams;
    sendSuccess(res, await analysesService.getForUser(authUser(req).id, id));
  },

  async getImage(req: Request, res: Response) {
    const { id } = req.params as AnalysisIdParams;
    const image = await analysesService.getImage(authUser(req).id, id);
    // Stored photos never change, but they are private to the user.
    res.type('image/jpeg').set('Cache-Control', 'private, max-age=3600').send(image);
  },
};
