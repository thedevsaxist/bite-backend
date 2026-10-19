import { z } from 'zod';

export const analysisIdSchema = z.object({
  id: z.string().min(1),
});

/** Text fields of the multipart POST /analyses request (the photo itself is the "image" file). */
export const createAnalysisSchema = z.object({
  // Optional meal notes: ingredients, cooking method, how much was eaten.
  context: z
    .string()
    .trim()
    .max(1000, 'Keep the meal notes under 1000 characters')
    .optional()
    .transform((value) => value || undefined),
});

export type CreateAnalysisBody = z.infer<typeof createAnalysisSchema>;
export type AnalysisIdParams = z.infer<typeof analysisIdSchema>;
