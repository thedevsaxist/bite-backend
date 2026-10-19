import { env } from '../../config/env.js';
import type { ImageStore } from './image-store.js';
import { createLocalStore } from './local-store.js';
import { createSupabaseStore } from './supabase-store.js';

export type { ImageStore } from './image-store.js';

let store: ImageStore | undefined;

/** The photo store chosen by STORAGE_DRIVER, created on first use. */
export function imageStore(): ImageStore {
  store ??=
    env.STORAGE_DRIVER === 'supabase'
      ? createSupabaseStore({
          // Both are checked at startup when STORAGE_DRIVER=supabase.
          url: env.SUPABASE_URL!,
          secretKey: env.SUPABASE_SECRET_KEY!,
          bucket: env.SUPABASE_STORAGE_BUCKET,
        })
      : createLocalStore(env.UPLOAD_DIR);
  return store;
}
