import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { prepareImage } from '../src/modules/analyses/image-processing.js';
import {
  deleteImage,
  imageUrl,
  readImage,
  saveImage,
} from '../src/modules/analyses/image-storage.js';
import { uploadedImage, uploadMealImage } from '../src/modules/analyses/image-upload.js';
import { blurryJpeg, sharpJpeg } from './images.js';

// A small limit so the oversized-file test doesn't need a 10 MB body.
// Hoisted so it is set before the env module is first imported.
vi.hoisted(() => {
  process.env.MAX_UPLOAD_SIZE_MB = '1';
});

// The analyses endpoint arrives in stage 8; this route exercises the same middleware chain.
const app = express();
app.post('/upload', uploadMealImage, async (req, res) => {
  const image = await prepareImage(uploadedImage(req).buffer);
  const reference = await saveImage('user-1', image.data);
  res.json({ reference, width: image.width, height: image.height });
});
app.use(errorHandler);

describe('meal image upload', () => {
  it('accepts an image sent as application/octet-stream and stores it', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('image', await sharpJpeg(), {
        filename: 'meal.bin',
        contentType: 'application/octet-stream',
      });

    expect(res.status).toBe(200);
    expect(res.body.reference).toMatch(/^user-1\/[0-9a-f-]{36}\.jpg$/);
    expect(await readImage(res.body.reference)).toBeInstanceOf(Buffer);
  });

  it('requires the image field', async () => {
    const missing = await request(app).post('/upload').field('context', 'rice');
    const wrongField = await request(app)
      .post('/upload')
      .attach('photo', await sharpJpeg(), 'meal.jpg');

    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('IMAGE_REQUIRED');
    expect(wrongField.status).toBe(400);
    expect(wrongField.body.error.code).toBe('LIMIT_UNEXPECTED_FILE');
  });

  it('rejects files over the size limit', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('image', Buffer.alloc(1.5 * 1024 * 1024), 'meal.jpg');

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('LIMIT_FILE_SIZE');
  });

  it('returns the validation error for a blurry photo', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('image', await blurryJpeg(), 'meal.jpg');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IMAGE_TOO_BLURRY');
  });
});

describe('image storage', () => {
  it('saves, reads and deletes an image', async () => {
    const data = Buffer.from('jpeg bytes');
    const reference = await saveImage('user-2', data);

    expect(await readImage(reference)).toEqual(data);
    // Local storage has no direct links; the API serves the photo itself.
    expect(await imageUrl(reference)).toBeNull();
    await deleteImage(reference);
    expect(await readImage(reference)).toBeNull();
  });

  it('refuses references outside the upload folder', async () => {
    await expect(readImage('../../etc/passwd')).rejects.toThrow('outside the upload folder');
    await expect(deleteImage('/etc/passwd')).rejects.toThrow('outside the upload folder');
  });
});
