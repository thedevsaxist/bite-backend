import type { Request, Response } from 'express';
import { authUser } from '../../middlewares/require-auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import type { DailySummaryQuery, RangeSummaryQuery } from './summary.schemas.js';
import { summaryService } from './summary.service.js';

export const summaryController = {
  daily(req: Request, res: Response) {
    const query = req.query as unknown as DailySummaryQuery;
    sendSuccess(res, { summary: summaryService.daily(authUser(req).id, query) });
  },

  range(req: Request, res: Response) {
    const query = req.query as unknown as RangeSummaryQuery;
    sendSuccess(res, { summary: summaryService.range(authUser(req).id, query) });
  },
};
