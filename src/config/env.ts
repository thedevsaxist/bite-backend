import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const commaList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const optionalString = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: z.string().min(1).default('./data/app.db'),

    CORS_ORIGIN: z.string().default('*'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

    GOOGLE_CLIENT_IDS: commaList,
    APPLE_CLIENT_IDS: commaList,

    // Where meal photos are stored: "local" (UPLOAD_DIR on disk) or "supabase" (Supabase Storage).
    STORAGE_DRIVER: z.enum(['local', 'supabase']).default('local'),
    UPLOAD_DIR: z.string().default('./uploads'),
    SUPABASE_URL: optionalString.pipe(z.url().optional()),
    // Server-only key (sb_secret_… or the legacy service_role key). Never ship it in the app.
    SUPABASE_SECRET_KEY: optionalString,
    SUPABASE_STORAGE_BUCKET: z.string().min(1).default('meal-images'),
    // How long the signed photo links handed to the app stay valid.
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
    MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(10),
    // Images whose sharpness score (variance of the Laplacian) is below this are rejected as blurry.
    // Calibrated on food photos: sharp ones scored 180–1340, strongly blurred ones under 20.
    IMAGE_BLUR_THRESHOLD: z.coerce.number().nonnegative().default(30),

    // Food recognition (Claude). Without a key the server still runs; analyses return 503.
    ANTHROPIC_API_KEY: optionalString,
    AI_MODEL: z.string().min(1).default('claude-opus-5-5'),
    // How much the model reasons before answering: higher is slower and costs more.
    AI_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('medium'),
    AI_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(90),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER !== 'supabase') return;
    for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `Required when STORAGE_DRIVER=supabase`,
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
