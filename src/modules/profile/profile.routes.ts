import { Router } from 'express';

// Stage 3 (report §3.4.1 FR 3–4): user profile and daily calorie reference.
// Planned (all require auth):
//   GET  /profile                     current profile (age, sex, weight, height, activity, goal)
//   PUT  /profile                     create or update the profile; recalculates the reference
//   GET  /profile/dietary-reference   latest estimated daily calorie reference
export const profileRouter = Router();
