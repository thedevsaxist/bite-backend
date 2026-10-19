import { z } from 'zod';

export const searchFoodsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const foodIdSchema = z.object({
  id: z.string().min(1),
});

export type SearchFoodsQuery = z.infer<typeof searchFoodsSchema>;
export type FoodIdParams = z.infer<typeof foodIdSchema>;
