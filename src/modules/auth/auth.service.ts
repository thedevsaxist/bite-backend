import { db, type Executor } from '../../db/index.js';
import { isUniqueConstraintError } from '../../db/errors.js';
import type { AuthProvider, User } from '../../db/schema/index.js';
import { AppError } from '../../utils/app-error.js';
import { usersRepository } from '../users/users.repository.js';
import { toPublicUser } from '../users/users.service.js';
import { authRepository } from './auth.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { hashPassword, verifyPassword } from './password.js';
import type { SocialProfile } from './social/verify-id-token.js';
import {
  accessTokenTtlSeconds,
  generateRefreshToken,
  hashToken,
  refreshTokenTtlMs,
  signAccessToken,
} from './tokens.js';

const invalidRefreshToken = (message: string) =>
  new AppError(401, message, 'INVALID_REFRESH_TOKEN');

function assertActive(user: User) {
  if (user.accountStatus !== 'active') {
    throw new AppError(403, 'This account is not active', 'ACCOUNT_INACTIVE');
  }
}

/** Stores a new refresh token for the user and returns the raw token (only its hash is stored). */
function createRefreshToken(userId: string, executor: Executor = db) {
  const token = generateRefreshToken();
  const row = authRepository.createRefreshToken(
    { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + refreshTokenTtlMs) },
    executor,
  );
  return { id: row.id, token };
}

async function buildTokens(userId: string, refreshToken: string) {
  return {
    accessToken: await signAccessToken(userId),
    refreshToken,
    tokenType: 'Bearer' as const,
    expiresIn: accessTokenTtlSeconds,
  };
}

/** Signs the user in on a new device/session. */
async function startSession(user: User, isNewUser: boolean) {
  assertActive(user);
  const { token } = createRefreshToken(user.id);
  return { user: toPublicUser(user), tokens: await buildTokens(user.id, token), isNewUser };
}

export const authService = {
  async register({ email, password, name }: RegisterInput) {
    if (usersRepository.findByEmail(email)) {
      throw AppError.conflict('An account with this email already exists');
    }

    const passwordHash = await hashPassword(password);
    let user: User;
    try {
      user = usersRepository.create({ email, passwordHash, name: name ?? null });
    } catch (err) {
      // Two sign-ups with the same email at the same moment: the second one hits the UNIQUE index.
      if (isUniqueConstraintError(err)) {
        throw AppError.conflict('An account with this email already exists');
      }
      throw err;
    }
    return startSession(user, true);
  },

  async login({ email, password }: LoginInput) {
    const user = usersRepository.findByEmail(email);
    // Same error for unknown email, wrong password, and social-only accounts, so nothing leaks.
    const valid = await verifyPassword(user?.passwordHash, password);
    if (!user || !valid) throw AppError.unauthorized('Invalid email or password');

    return startSession(user, false);
  },

  /**
   * Signs in with a verified Google/Apple profile. Order of matching:
   * 1. an account already linked to this provider identity;
   * 2. an existing account with the same (provider-verified) email, which gets linked;
   * 3. otherwise a new account is created.
   */
  async socialSignIn(provider: AuthProvider, profile: SocialProfile) {
    const identity = authRepository.findIdentity(provider, profile.providerUserId);
    if (identity) {
      const user = usersRepository.findById(identity.userId);
      if (!user) throw AppError.unauthorized();
      return startSession(user, false);
    }

    if (!profile.email || !profile.emailVerified) {
      throw AppError.badRequest(`Your ${provider} account has no verified email address`);
    }
    const email = profile.email.toLowerCase();

    const { user, isNewUser } = db.transaction((tx) => {
      const existing = usersRepository.findByEmail(email, tx);
      const user = existing ?? usersRepository.create({ email, name: profile.name }, tx);
      authRepository.createIdentity(
        { userId: user.id, provider, providerUserId: profile.providerUserId },
        tx,
      );
      return { user, isNewUser: !existing };
    });

    return startSession(user, isNewUser);
  },

  /**
   * Exchanges a refresh token for a new access token *and* a new refresh token (rotation).
   * Presenting an already-rotated token means it was copied by someone else, so every session
   * for that user is revoked and they must sign in again.
   */
  async refresh(refreshToken: string) {
    const stored = authRepository.findRefreshTokenByHash(hashToken(refreshToken));
    if (!stored) throw invalidRefreshToken('Invalid refresh token');

    if (stored.revokedAt) {
      authRepository.revokeAllRefreshTokensForUser(stored.userId);
      throw invalidRefreshToken('Refresh token has already been used');
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw invalidRefreshToken('Refresh token has expired');
    }

    const user = usersRepository.findById(stored.userId);
    if (!user) throw invalidRefreshToken('Invalid refresh token');
    assertActive(user);

    const next = db.transaction((tx) => {
      const next = createRefreshToken(user.id, tx);
      authRepository.revokeRefreshToken(stored.id, next.id, tx);
      return next;
    });

    return { tokens: await buildTokens(user.id, next.token) };
  },

  /** Ends the session that owns this refresh token. Idempotent: unknown tokens are ignored. */
  logout(refreshToken: string) {
    const stored = authRepository.findRefreshTokenByHash(hashToken(refreshToken));
    if (stored) authRepository.revokeRefreshToken(stored.id);
  },
};
