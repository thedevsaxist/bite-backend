import { Router } from 'express';

// Stage 9 (report §3.4.1 FR 18–19): intake totals compared with the daily calorie reference.
// Planned (all require auth):
//   GET /summary/daily?date   one day's totals vs the daily reference
//   GET /summary?from&to      per-day totals over a period
export const summaryRouter = Router();
