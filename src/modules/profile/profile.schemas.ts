import { z } from 'zod';
import { activityLevels, sexes, weightGoals } from '../../db/schema/index.js';

// Ranges keep the calorie equation within the adult population it was developed for.
const profileFields = {
  age: z.number().int().min(18).max(120),
  sex: z.enum(sexes),
  weightKg: z.number().min(20).max(500),
  heightCm: z.number().min(50).max(275),
  activityLevel: z.enum(activityLevels),
  weightGoal: z.enum(weightGoals),
};

/** PUT /profile: the full profile. */
export const putProfileSchema = z.strictObject(profileFields);

/** PATCH /profile: any subset, but at least one field. */
export const patchProfileSchema = z
  .strictObject(profileFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export type PutProfileInput = z.infer<typeof putProfileSchema>;
export type PatchProfileInput = z.infer<typeof patchProfileSchema>;
