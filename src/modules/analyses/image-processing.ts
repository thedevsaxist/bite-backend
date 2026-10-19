import sharp, { type Sharp } from 'sharp';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';

// Image validation (report §3.4.1 FR 8–9): checks that an upload is a usable photo before it is
// sent to the AI model. Images are never upscaled; large ones are only scaled down.

const supportedFormats = new Set(['jpeg', 'png', 'webp']);

/** Smaller than this on the short side carries too little detail to recognise food. */
export const MIN_DIMENSION = 256;
/** Larger images are scaled down to fit; vision models gain little beyond this. */
export const MAX_OUTPUT_DIMENSION = 1568;
/** Rejects decompression bombs: a tiny file that decodes to an enormous image. */
export const MAX_INPUT_PIXELS = 40_000_000;
/** Sharpness is measured at this size, so the score doesn't depend on the upload's resolution. */
const SHARPNESS_SAMPLE_SIZE = 512;

export type PreparedImage = {
  data: Buffer;
  mediaType: 'image/jpeg';
  width: number;
  height: number;
  sharpness: number;
};

const imageError = (statusCode: number, code: string, message: string) =>
  new AppError(statusCode, message, code);

/**
 * Sharpness score: the variance of the Laplacian of the greyscale image. Edges give large Laplacian
 * values, so a blurry or blank image has a low variance.
 */
export async function measureSharpness(image: Sharp) {
  const { data, info } = await image
    .clone()
    .removeAlpha()
    .greyscale()
    .resize(SHARPNESS_SAMPLE_SIZE, SHARPNESS_SAMPLE_SIZE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (width < 3 || height < 3) return 0;

  const at = (x: number, y: number) => data[(y * width + x) * channels]!;
  let sum = 0;
  let sumOfSquares = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const laplacian = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) - 4 * at(x, y);
      sum += laplacian;
      sumOfSquares += laplacian * laplacian;
    }
  }

  const count = (width - 2) * (height - 2);
  const mean = sum / count;
  return Math.round((sumOfSquares / count - mean * mean) * 10) / 10;
}

/**
 * Validates an uploaded image and converts it to what the rest of the system stores and sends to
 * the AI model: upright (EXIF orientation applied), at most MAX_OUTPUT_DIMENSION on the long side,
 * JPEG, with all metadata (including GPS location) removed.
 */
export async function prepareImage(input: Buffer): Promise<PreparedImage> {
  const image = sharp(input, { limitInputPixels: false, failOn: 'error' });

  let metadata;
  try {
    metadata = await image.metadata();
  } catch {
    throw imageError(400, 'INVALID_IMAGE', 'The file is not a readable image');
  }

  if (!metadata.format || !supportedFormats.has(metadata.format)) {
    throw imageError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Upload a JPEG, PNG or WebP image');
  }

  const { width = 0, height = 0 } = metadata;
  if (width * height > MAX_INPUT_PIXELS) {
    throw imageError(413, 'IMAGE_TOO_LARGE', 'The image has too many pixels');
  }
  if (Math.min(width, height) < MIN_DIMENSION) {
    throw imageError(
      422,
      'IMAGE_TOO_SMALL',
      `The image must be at least ${MIN_DIMENSION}×${MIN_DIMENSION} pixels`,
    );
  }

  try {
    // Turns the image upright according to its EXIF orientation.
    const upright = image.rotate();

    const sharpness = await measureSharpness(upright);
    if (sharpness < env.IMAGE_BLUR_THRESHOLD) {
      throw imageError(422, 'IMAGE_TOO_BLURRY', 'The image is too blurry. Take a clearer photo');
    }

    const { data, info } = await upright
      .resize(MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      // JPEG has no transparency, so transparent areas become white rather than black.
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85 })
      .toBuffer({ resolveWithObject: true });

    return { data, mediaType: 'image/jpeg', width: info.width, height: info.height, sharpness };
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Header was readable but the pixel data is corrupt or truncated.
    throw imageError(400, 'INVALID_IMAGE', 'The file is not a readable image');
  }
}
