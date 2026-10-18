import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt, id, timestamp } from './columns.js';
import { users } from './users.js';

export const authProviders = ['google', 'apple'] as const;
export type AuthProvider = (typeof authProviders)[number];

/** Links a user to a Google/Apple account. A user can have several identities (and/or a password). */
export const authIdentities = sqliteTable(
  'auth_identities',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text({ enum: authProviders }).notNull(),
    // The provider's stable user ID (the `sub` claim of the ID token).
    providerUserId: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('auth_identities_provider_user_idx').on(t.provider, t.providerUserId),
    index('auth_identities_user_idx').on(t.userId),
  ],
);

/**
 * One row per issued refresh token (i.e. per signed-in device/session).
 * Only a SHA-256 hash of the token is stored, so a leaked database can't be used to sign in.
 */
export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp().notNull(),
    revokedAt: timestamp(),
    // Set when the token is rotated, pointing at the token that replaced it.
    replacedById: text(),
    createdAt: createdAt(),
  },
  (t) => [index('refresh_tokens_user_idx').on(t.userId)],
);

export type AuthIdentity = typeof authIdentities.$inferSelect;
export type NewAuthIdentity = typeof authIdentities.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
