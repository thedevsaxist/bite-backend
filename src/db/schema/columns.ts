import { randomUUID } from 'node:crypto';
import { integer, text } from 'drizzle-orm/sqlite-core';

// Shared column builders so every table uses the same id and timestamp conventions.

export const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => randomUUID());

export const timestamp = () => integer({ mode: 'timestamp_ms' });

export const createdAt = () =>
  timestamp()
    .notNull()
    .$defaultFn(() => new Date());

export const updatedAt = () =>
  timestamp()
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());
