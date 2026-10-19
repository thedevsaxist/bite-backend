import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { imageStore } from '../../integrations/storage/index.js';

// Meal photos are stored as <userId>/<uuid>.jpg, in the folder or bucket chosen by STORAGE_DRIVER.
// The database stores only that path (food_analyses.image_reference), so the storage can change
// without a migration.

/** Saves a prepared JPEG and returns its reference. */
export async function saveImage(userId: string, data: Buffer) {
  const reference = `${userId}/${randomUUID()}.jpg`;
  await imageStore().save(reference, data, 'image/jpeg');
  return reference;
}

/** Reads a stored image, or returns null if it no longer exists. */
export function readImage(reference: string) {
  return imageStore().read(reference);
}

export function deleteImage(reference: string) {
  return imageStore().remove(reference);
}

/**
 * A short-lived link the app can load the photo from, or null when the store has no direct links
 * (local storage), in which case the app uses GET /analyses/:id/image instead.
 */
export function imageUrl(reference: string) {
  return imageStore().signedUrl(reference, env.SIGNED_URL_TTL_SECONDS);
}
