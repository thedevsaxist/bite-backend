import { beforeEach, describe, expect, it, vi } from 'vitest';
import { imageUrl, imageUrls } from '../src/modules/analyses/image-storage.js';

// A photo store that is down: signing fails the way the Supabase store fails.
const store = { signedUrl: vi.fn(), signedUrls: vi.fn() };
vi.mock('../src/integrations/storage/index.js', () => ({ imageStore: () => store }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('photo links', () => {
  it('returns the store links when it answers', async () => {
    store.signedUrl.mockResolvedValue('https://x/sign/1');
    store.signedUrls.mockResolvedValue(['https://x/sign/1', null]);

    expect(await imageUrl('u/1.jpg')).toBe('https://x/sign/1');
    expect(await imageUrls(['u/1.jpg', 'u/2.jpg'])).toEqual(['https://x/sign/1', null]);
  });

  it('returns no link instead of failing when the store is unavailable', async () => {
    const unavailable = Object.assign(new Error('Photo storage is unavailable'), {
      statusCode: 503,
      code: 'STORAGE_UNAVAILABLE',
    });
    store.signedUrl.mockRejectedValue(unavailable);
    store.signedUrls.mockRejectedValue(unavailable);

    expect(await imageUrl('u/1.jpg')).toBeNull();
    expect(await imageUrls(['u/1.jpg', 'u/2.jpg'])).toEqual([null, null]);
  });
});
