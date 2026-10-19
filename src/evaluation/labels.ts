import { z } from 'zod';

// The labelled test set (evaluation/dataset/labels.json). One entry per photo.

export const labelSchema = z.strictObject({
  // Path of the photo, relative to the dataset folder.
  image: z.string().min(1),
  // Optional meal notes, sent to the AI as a user would.
  context: z.string().max(1000).optional(),
  // What is really in the photo. Use catalog keys (e.g. "jollof_rice") for foods in the nutrition
  // data; for other foods use the plain name, which then has to match the AI's name for the food.
  foods: z.array(z.string().trim().min(1)).min(1),
  // The meal's real calories, e.g. from weighing the food, if known.
  referenceCalories: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const labelsFileSchema = z.array(labelSchema).min(1, 'The dataset has no photos');

export type Label = z.infer<typeof labelSchema>;

/** Labels are compared case- and spacing-insensitively. */
export const normaliseLabel = (label: string) => label.trim().toLowerCase().replace(/\s+/g, ' ');
