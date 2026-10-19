import { Router } from 'express';

// Stages 5–8 (report §3.5.1, §3.5.4, §3.5.5): image upload, validation, AI recognition and
// calorie estimation. The stored analysis keeps the original AI result.
// Planned (all require auth):
//   POST /analyses                 multipart image + optional context → analysis result   (stage 8)
//   GET  /analyses/:id             one analysis with its recognised items                  (stage 6)
//   GET  /analyses/:id/image       the submitted image                                     (stage 6)
//   POST /analyses/:id/validate    save the (optionally edited) result as a meal record    (stage 9)
//   POST /analyses/:id/dispute     mark the result as not representing the meal            (stage 9)
export const analysesRouter = Router();
