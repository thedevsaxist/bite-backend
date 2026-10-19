import { z } from 'zod';

export const analysisIdSchema = z.object({
  id: z.string().min(1),
});

export type AnalysisIdParams = z.infer<typeof analysisIdSchema>;
