// Where meal photos are kept. The app picks an implementation with STORAGE_DRIVER; the rest of the
// code only sees this interface and stores the object path (e.g. "<userId>/<uuid>.jpg") in the database.

export interface ImageStore {
  readonly driver: 'local' | 'supabase';
  save(path: string, data: Buffer, contentType: string): Promise<void>;
  /** The stored bytes, or null if nothing is stored at `path`. */
  read(path: string): Promise<Buffer | null>;
  /** Removes the object. Does nothing if it doesn't exist. */
  remove(path: string): Promise<void>;
  /**
   * A temporary link the app can load the photo from directly, or null when this store has no
   * direct links (the API then serves the photo itself).
   */
  signedUrl(path: string, expiresInSeconds: number): Promise<string | null>;
  /** [signedUrl] for several photos in one request, in the same order (null for a missing one). */
  signedUrls(paths: string[], expiresInSeconds: number): Promise<(string | null)[]>;
}
