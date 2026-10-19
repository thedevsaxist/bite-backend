import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { validate } from '../../middlewares/validate.js';
import { summaryController } from './summary.controller.js';
import { dailySummarySchema, rangeSummarySchema } from './summary.schemas.js';

// Report §3.4.1 FR 18–19: intake totals compared with the daily calorie reference.
export const summaryRouter = Router();

summaryRouter.use(requireAuth);

summaryRouter.get('/', validate({ query: rangeSummarySchema }), summaryController.range);
summaryRouter.get('/daily', validate({ query: dailySummarySchema }), summaryController.daily);
