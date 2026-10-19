import type { Request } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';

/**
 * Accepts one image in the multipart field "image", kept in memory so it can be validated before
 * anything is written to disk. The file type isn't checked here because clients often send
 * application/octet-stream; prepareImage() checks the actual image format instead.
 * Oversized files are rejected by multer with 413 LIMIT_FILE_SIZE.
 */
export const uploadMealImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, files: 1 },
}).single('image');

/** The uploaded image. Only call this in handlers that run after `uploadMealImage`. */
export function uploadedImage(req: Request) {
  if (!req.file) {
    throw new AppError(400, 'Attach a meal photo in the "image" field', 'IMAGE_REQUIRED');
  }
  return req.file;
}
