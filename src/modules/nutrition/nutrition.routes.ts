import { Router } from 'express';

// Stage 4 (report §3.4.1 FR 13, 21): seeded nutritional reference data.
// Planned (all require auth):
//   GET /nutrition/foods?q=   search reference foods (used when the user edits an item)
//   GET /nutrition/foods/:id  one reference food with its per-serving values
export const nutritionRouter = Router();
