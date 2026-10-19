import { logger } from '../../config/logger.js';
import type { User } from '../../db/schema/index.js';
import { AppError } from '../../utils/app-error.js';
import { analysesRepository } from '../analyses/analyses.repository.js';
import { deleteImage } from '../analyses/image-storage.js';
import { verifyPassword } from '../auth/password.js';
import { usersRepository } from './users.repository.js';

/** The user as the API exposes it: never includes the password hash. */
export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    hasPassword: user.passwordHash !== null,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;

export const usersService = {
  getById(id: string) {
    const user = usersRepository.findById(id);
    if (!user) throw AppError.notFound('User not found');
    return toPublicUser(user);
  },

  /**
   * Permanently deletes the account and everything stored for it (report §3.4.2 NFR 5, privacy):
   * profile, settings, analyses, meal history, sessions and meal photos.
   */
  async deleteAccount(id: string, password?: string) {
    const user = usersRepository.findById(id);
    if (!user) throw AppError.notFound('User not found');
    if (user.passwordHash) {
      if (!password) {
        throw new AppError(400, 'Enter your password to delete the account', 'PASSWORD_REQUIRED');
      }
      if (!(await verifyPassword(user.passwordHash, password))) {
        throw new AppError(403, 'The password is incorrect', 'INVALID_PASSWORD');
      }
    }

    const photos = analysesRepository.listImageReferences(id);
    usersRepository.delete(id);

    // The records are gone, so the account is deleted even if some photos can't be removed now.
    const results = await Promise.allSettled(photos.map((photo) => deleteImage(photo)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0)
      logger.error({ userId: id, failed }, 'Some photos of a deleted account were not removed');
  },
};
