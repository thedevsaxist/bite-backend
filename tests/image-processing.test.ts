import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  MAX_OUTPUT_DIMENSION,
  measureSharpness,
  prepareImage,
} from '../src/modules/analyses/image-processing.js';
import { blankJpeg, blurryJpeg, sharpImage, sharpJpeg } from './images.js';

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('Expected the image to be rejected');
    },
    (err: { statusCode: number; code: string }) => ({ status: err.statusCode, code: err.code }),
  );

describe('measureSharpness', () => {
  it('scores sharp images far above blurry or blank ones', async () => {
    const sharpScore = await measureSharpness(sharp(await sharpJpeg()));
    const blurryScore = await measureSharpness(sharp(await blurryJpeg()));
    const blankScore = await measureSharpness(sharp(await blankJpeg()));

    expect(sharpScore).toBeGreaterThan(1000);
    expect(blurryScore).toBeLessThan(30);
    expect(blankScore).toBe(0);
  });
});

describe('prepareImage', () => {
  it('accepts a sharp JPEG and returns a JPEG of the same size', async () => {
    const prepared = await prepareImage(await sharpJpeg());

    expect(prepared).toMatchObject({ mediaType: 'image/jpeg', width: 800, height: 600 });
    expect((await sharp(prepared.data).metadata()).format).toBe('jpeg');
  });

  it('accepts PNG and WebP, and turns transparency white', async () => {
    const png = await sharpImage({ channels: 4 }).png().toBuffer();
    const webp = await sharpImage().webp().toBuffer();

    const fromPng = await prepareImage(png);
    await expect(prepareImage(webp)).resolves.toMatchObject({ mediaType: 'image/jpeg' });
    expect((await sharp(fromPng.data).metadata()).hasAlpha).toBe(false);
  });

  it('scales large images down to fit, keeping the aspect ratio', async () => {
    const prepared = await prepareImage(
      await sharpImage({ width: 3000, height: 2000 }).jpeg().toBuffer(),
    );

    expect(prepared.width).toBe(MAX_OUTPUT_DIMENSION);
    expect(prepared.height).toBe(Math.round((MAX_OUTPUT_DIMENSION * 2000) / 3000));
  });

  it('never upscales', async () => {
    const prepared = await prepareImage(await sharpJpeg({ width: 300, height: 400 }));
    expect([prepared.width, prepared.height]).toEqual([300, 400]);
  });

  it('applies the EXIF orientation and strips metadata', async () => {
    // Orientation 6 = the camera was held sideways, so the stored landscape image is shown portrait.
    const rotated = await sharpImage()
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Make: 'TestPhone' } })
      .jpeg()
      .toBuffer();

    const prepared = await prepareImage(rotated);
    const metadata = await sharp(prepared.data).metadata();

    expect([prepared.width, prepared.height]).toEqual([600, 800]);
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
  });

  it('rejects blurry and blank photos', async () => {
    expect(await rejection(prepareImage(await blurryJpeg()))).toEqual({
      status: 422,
      code: 'IMAGE_TOO_BLURRY',
    });
    expect(await rejection(prepareImage(await blankJpeg()))).toEqual({
      status: 422,
      code: 'IMAGE_TOO_BLURRY',
    });
  });

  it('rejects images that are too small', async () => {
    expect(await rejection(prepareImage(await sharpJpeg({ width: 800, height: 200 })))).toEqual({
      status: 422,
      code: 'IMAGE_TOO_SMALL',
    });
  });

  it('rejects images with too many pixels without decoding them', async () => {
    const huge = await sharp({
      create: { width: 8000, height: 6000, channels: 3, background: '#888' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    expect(await rejection(prepareImage(huge))).toEqual({ status: 413, code: 'IMAGE_TOO_LARGE' });
  });

  it('rejects unsupported formats', async () => {
    const gif = await sharpImage().gif().toBuffer();
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600"/></svg>',
    );

    expect(await rejection(prepareImage(gif))).toEqual({
      status: 415,
      code: 'UNSUPPORTED_IMAGE_TYPE',
    });
    expect(await rejection(prepareImage(svg))).toEqual({
      status: 415,
      code: 'UNSUPPORTED_IMAGE_TYPE',
    });
  });

  it('rejects files that are not images, or are corrupt', async () => {
    const jpeg = await sharpJpeg();
    const truncated = jpeg.subarray(0, Math.floor(jpeg.length / 3));

    expect(await rejection(prepareImage(Buffer.from('not an image')))).toEqual({
      status: 400,
      code: 'INVALID_IMAGE',
    });
    expect(await rejection(prepareImage(truncated))).toEqual({
      status: 400,
      code: 'INVALID_IMAGE',
    });
  });
});
