import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
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
 *
 * Also null when the store can't be reached: a meal or analysis is still worth returning without
 * its photo, and the app shows a placeholder.
 */
export async function imageUrl(reference: string) {
  try {
    return await imageStore().signedUrl(reference, env.SIGNED_URL_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err }, 'Could not create a photo link');
    return null;
  }
}

/** [imageUrl] for several photos in one request, in the same order. */
export async function imageUrls(references: string[]) {
  try {
    return await imageStore().signedUrls(references, env.SIGNED_URL_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err, count: references.length }, 'Could not create photo links');
    return references.map(() => null);
  }
}
