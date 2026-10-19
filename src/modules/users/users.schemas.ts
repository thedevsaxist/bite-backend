import { z } from 'zod';

/** DELETE /users/me. Accounts with a password must confirm it; others may send no body. */
export const deleteAccountSchema = z
  .strictObject({
    password: z.string().min(1).optional(),
  })
  .default({});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
