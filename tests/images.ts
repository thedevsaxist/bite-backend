import sharp from 'sharp';

// Test images generated on the fly. Gaussian noise is full of edges, so it scores as very sharp;
// blurring it removes the edges and makes it score as blurry.

type Options = { width?: number; height?: number; channels?: 3 | 4 };

export function sharpImage({ width = 800, height = 600, channels = 3 }: Options = {}) {
  return sharp({
    create: {
      width,
      height,
      channels,
      background: { r: 200, g: 120, b: 60, alpha: 1 },
      noise: { type: 'gaussian', mean: 128, sigma: 40 },
    },
  });
}

export const sharpJpeg = (options?: Options) =>
  sharpImage(options).jpeg({ quality: 80 }).toBuffer();

export async function blurryJpeg(options?: Options) {
  return sharp(await sharpImage(options).png().toBuffer())
    .blur(10)
    .jpeg()
    .toBuffer();
}

export function blankJpeg({ width = 800, height = 600 }: Options = {}) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 240, g: 240, b: 240 } },
  })
    .jpeg()
    .toBuffer();
}
