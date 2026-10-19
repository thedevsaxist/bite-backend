import { createClient } from '@supabase/supabase-js';
import { AppError } from '../../utils/app-error.js';
import type { ImageStore } from './image-store.js';

type SupabaseStoreOptions = { url: string; secretKey: string; bucket: string };

const storageUnavailable = (cause: unknown) => {
  const error = new AppError(
    503,
    'Photo storage is unavailable, try again later',
    'STORAGE_UNAVAILABLE',
  );
  error.cause = cause;
  return error;
};

// Supabase answers a missing object with HTTP 400 and statusCode "404" in the body.
const isNotFound = (error: { statusCode?: string }) => error.statusCode === '404';

/**
 * Stores photos in a private Supabase Storage bucket. Uses the server-only secret key, so the
 * bucket needs no access policies: the app never talks to Supabase directly, it only receives
 * short-lived signed links.
 */
export function createSupabaseStore({ url, secretKey, bucket }: SupabaseStoreOptions): ImageStore {
  const client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const objects = () => client.storage.from(bucket);

  return {
    driver: 'supabase',

    async save(path, data, contentType) {
      const { error } = await objects().upload(path, data, { contentType, upsert: false });
      if (error) throw storageUnavailable(error);
    },

    async read(path) {
      const { data, error } = await objects().download(path);
      if (error) {
        if (isNotFound(error)) return null;
        throw storageUnavailable(error);
      }
      return Buffer.from(await data.arrayBuffer());
    },

    async remove(path) {
      // Removing a missing object succeeds with an empty list, so only real failures error.
      const { error } = await objects().remove([path]);
      if (error) throw storageUnavailable(error);
    },

    async signedUrl(path, expiresInSeconds) {
      const { data, error } = await objects().createSignedUrl(path, expiresInSeconds);
      if (error) {
        if (isNotFound(error)) return null;
        throw storageUnavailable(error);
      }
      return data.signedUrl;
    },

    async signedUrls(paths, expiresInSeconds) {
      if (paths.length === 0) return [];
      const { data, error } = await objects().createSignedUrls(paths, expiresInSeconds);
      if (error) throw storageUnavailable(error);
      // Each entry carries its own error, e.g. for a photo that no longer exists.
      const byPath = new Map(
        data.map((entry) => [entry.path, entry.error ? null : entry.signedUrl]),
      );
      return paths.map((path) => byPath.get(path) ?? null);
    },
  };
}
