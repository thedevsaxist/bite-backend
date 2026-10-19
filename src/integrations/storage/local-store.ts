import fs from 'node:fs/promises';
import path from 'node:path';
import type { ImageStore } from './image-store.js';

/** Stores photos as files under `root`. For development, tests and offline use. */
export function createLocalStore(root: string): ImageStore {
  const resolvedRoot = path.resolve(root);

  // Refuses anything that would resolve outside the upload folder (e.g. "../../etc/passwd").
  const resolve = (objectPath: string) => {
    const absolute = path.resolve(resolvedRoot, objectPath);
    if (!absolute.startsWith(resolvedRoot + path.sep)) {
      throw new Error(`Image path is outside the upload folder: ${objectPath}`);
    }
    return absolute;
  };

  return {
    driver: 'local',

    async save(objectPath, data) {
      const absolute = resolve(objectPath);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, data);
    },

    async read(objectPath) {
      try {
        return await fs.readFile(resolve(objectPath));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },

    async remove(objectPath) {
      await fs.rm(resolve(objectPath), { force: true });
    },

    async signedUrl() {
      return null;
    },

    async signedUrls(paths) {
      return paths.map(() => null);
    },
  };
}
