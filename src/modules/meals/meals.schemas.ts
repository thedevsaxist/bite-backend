import { z } from 'zod';
import { quantityUnits } from '../../db/schema/index.js';

const amount = (max: number) => z.number().min(0).max(max);

/**
 * One food in a meal, as the user wants it saved. With nutritionReferenceId, the nutrients are
 * calculated from the reference food; without one, the user may give the calories (and
 * optionally macros) themselves, e.g. for a drink that isn't in the reference data.
 */
export const mealItemInputSchema = z
  .strictObject({
    // The AI-recognised item this corrects; leave out for a food the user adds.
    recognisedItemId: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(150),
    nutritionReferenceId: z.string().min(1).nullable().optional(),
    quantity: z.number().positive().max(10_000),
    unit: z.enum(quantityUnits),
    calories: amount(20_000).optional(),
    protein: amount(2_000).optional(),
    carbohydrates: amount(2_000).optional(),
    fat: amount(2_000).optional(),
  })
  .refine(
    (item) =>
      !item.nutritionReferenceId ||
      [item.calories, item.protein, item.carbohydrates, item.fat].every((v) => v === undefined),
    {
      message: 'Leave out nutrient values for a reference food; they are calculated',
      path: ['calories'],
    },
  );

/** Body of POST /analyses/:id/validate and PATCH /meals/:id. */
export const mealChangesSchema = z.strictObject({
  mealDate: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value))
    .optional(),
  // Replaces all of the meal's items. Leave out to keep them as they are.
  items: z.array(mealItemInputSchema).min(1).max(30).optional(),
});

export const mealIdSchema = z.object({
  id: z.string().min(1),
});

export const listMealsSchema = z
  .object({
    from: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
    to: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: '"from" must be before "to"',
    path: ['from'],
  });

export type MealItemInput = z.infer<typeof mealItemInputSchema>;
export type MealChanges = z.infer<typeof mealChangesSchema>;
export type MealIdParams = z.infer<typeof mealIdSchema>;
export type ListMealsQuery = z.infer<typeof listMealsSchema>;
