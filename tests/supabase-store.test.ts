import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseStore } from '../src/integrations/storage/supabase-store.js';

// A fake Supabase client: the bucket methods are mocks whose results each test sets.
const bucket = {
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
};
const from = vi.fn(() => bucket);
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ storage: { from } })),
}));

// What Supabase actually returns for a missing object (checked against a real project).
const notFound = {
  name: 'StorageApiError',
  status: 400,
  statusCode: '404',
  message: 'Object not found',
};
const serverError = { name: 'StorageApiError', status: 500, statusCode: '500', message: 'boom' };

const store = createSupabaseStore({
  url: 'https://project.supabase.co',
  secretKey: 'sb_secret_test',
  bucket: 'meal-images',
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Supabase image store', () => {
  it('creates a server-side client that keeps no session', () => {
    createSupabaseStore({
      url: 'https://project.supabase.co',
      secretKey: 'sb_secret_test',
      bucket: 'meal-images',
    });

    expect(createClient).toHaveBeenCalledWith('https://project.supabase.co', 'sb_secret_test', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it('uploads to the bucket without overwriting', async () => {
    bucket.upload.mockResolvedValue({ data: { path: 'u/1.jpg' }, error: null });
    const data = Buffer.from('jpeg');

    await store.save('u/1.jpg', data, 'image/jpeg');

    expect(from).toHaveBeenCalledWith('meal-images');
    expect(bucket.upload).toHaveBeenCalledWith('u/1.jpg', data, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  });

  it('reads an object, or returns null when it is missing', async () => {
    bucket.download.mockResolvedValueOnce({ data: new Blob(['jpeg bytes']), error: null });
    bucket.download.mockResolvedValueOnce({ data: null, error: notFound });

    expect((await store.read('u/1.jpg'))?.toString()).toBe('jpeg bytes');
    expect(await store.read('u/missing.jpg')).toBeNull();
  });

  it('returns a signed link, or null for a missing object', async () => {
    bucket.createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: 'https://project.supabase.co/storage/v1/object/sign/x?token=t' },
      error: null,
    });
    bucket.createSignedUrl.mockResolvedValueOnce({ data: null, error: notFound });

    expect(await store.signedUrl('u/1.jpg', 3600)).toMatch(/token=t$/);
    expect(bucket.createSignedUrl).toHaveBeenCalledWith('u/1.jpg', 3600);
    expect(await store.signedUrl('u/missing.jpg', 3600)).toBeNull();
  });

  it('removes an object', async () => {
    bucket.remove.mockResolvedValue({ data: [], error: null });
    await store.remove('u/1.jpg');
    expect(bucket.remove).toHaveBeenCalledWith(['u/1.jpg']);
  });

  it('reports other failures as STORAGE_UNAVAILABLE (503)', async () => {
    bucket.upload.mockResolvedValue({ data: null, error: serverError });
    bucket.download.mockResolvedValue({ data: null, error: serverError });
    bucket.remove.mockResolvedValue({ data: null, error: serverError });
    bucket.createSignedUrl.mockResolvedValue({ data: null, error: serverError });

    for (const attempt of [
      store.save('u/1.jpg', Buffer.from('x'), 'image/jpeg'),
      store.read('u/1.jpg'),
      store.remove('u/1.jpg'),
      store.signedUrl('u/1.jpg', 60),
    ]) {
      await expect(attempt).rejects.toMatchObject({ statusCode: 503, code: 'STORAGE_UNAVAILABLE' });
    }
  });
});
