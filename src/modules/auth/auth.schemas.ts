import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(255));

const name = z.string().trim().min(1).max(100);

export const registerSchema = z.object({
  email,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  name: name.optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const googleSignInSchema = z.object({
  idToken: z.string().min(1),
});

export const appleSignInSchema = z.object({
  idToken: z.string().min(1),
  nonce: z.string().min(1).optional(),
  // Only available to the app the first time the user signs in with Apple.
  name: name.optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;
export type AppleSignInInput = z.infer<typeof appleSignInSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
