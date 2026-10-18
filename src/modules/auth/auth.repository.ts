import { and, eq, isNull } from 'drizzle-orm';
import { db, type Executor } from '../../db/index.js';
import {
  authIdentities,
  refreshTokens,
  type AuthProvider,
  type NewAuthIdentity,
  type NewRefreshToken,
} from '../../db/schema/index.js';

export const authRepository = {
  findIdentity(provider: AuthProvider, providerUserId: string, executor: Executor = db) {
    return executor
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.provider, provider),
          eq(authIdentities.providerUserId, providerUserId),
        ),
      )
      .get();
  },

  createIdentity(data: NewAuthIdentity, executor: Executor = db) {
    return executor.insert(authIdentities).values(data).returning().get();
  },

  createRefreshToken(data: NewRefreshToken, executor: Executor = db) {
    return executor.insert(refreshTokens).values(data).returning().get();
  },

  findRefreshTokenByHash(tokenHash: string, executor: Executor = db) {
    return executor
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .get();
  },

  revokeRefreshToken(id: string, replacedById: string | null = null, executor: Executor = db) {
    executor
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedById })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
      .run();
  },

  revokeAllRefreshTokensForUser(userId: string, executor: Executor = db) {
    executor
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
      .run();
  },
};
