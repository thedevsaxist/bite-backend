import { z } from 'zod';

/** PATCH /settings: any subset of the settings, but at least one. */
export const patchSettingsSchema = z
  .strictObject({
    autoSaveResults: z.boolean(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one setting to update');

export type PatchSettingsInput = z.infer<typeof patchSettingsSchema>;
