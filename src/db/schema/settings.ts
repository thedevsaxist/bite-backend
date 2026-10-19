import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, id, updatedAt } from './columns.js';
import { users } from './users.js';

// Report §3.5.3 "User Settings": per-user app preferences. One per user, created on first read.
export const userSettings = sqliteTable('user_settings', {
  id: id(),
  userId: text()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  // When true, analysis results go straight into the food-intake history; when false the user
  // has to validate each result first (report §3.5.1).
  autoSaveResults: integer({ mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
