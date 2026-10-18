import type { User } from '../../db/schema/index.js';
import { AppError } from '../../utils/app-error.js';
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
};
