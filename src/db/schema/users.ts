import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, id, updatedAt } from './columns.js';

export const accountStatuses = ['active', 'suspended', 'deleted'] as const;
export type AccountStatus = (typeof accountStatuses)[number];

// Report §3.5.3 "Users": account and authentication information.
export const users = sqliteTable('users', {
  id: id(),
  email: text().notNull().unique(),
  name: text(),
  // Null for accounts created through Google/Apple that never set a password.
  passwordHash: text(),
  accountStatus: text({ enum: accountStatuses }).notNull().default('active'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
