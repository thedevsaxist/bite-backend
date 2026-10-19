import { Router } from 'express';

// Stage 9 (report §3.4.1 FR 16–18): meal records, i.e. the user's food-intake history.
// Planned (all require auth):
//   GET    /meals?from&to   meal records in a date range
//   GET    /meals/:id       one meal record with its items
//   PATCH  /meals/:id       edit items/portions; nutritional values are recalculated
//   DELETE /meals/:id       remove a meal record
export const mealsRouter = Router();
