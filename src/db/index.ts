import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

function openSqlite(url: string) {
  if (url !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(url)), { recursive: true });
  }

  const sqlite = new Database(url);
  // WAL gives much better read/write concurrency; SQLite doesn't enforce foreign keys unless asked.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return sqlite;
}

export const sqlite = openSqlite(env.DATABASE_URL);

// casing: camelCase properties in TypeScript map to snake_case columns in SQLite.
export const db = drizzle({ client: sqlite, schema, casing: 'snake_case' });

export type DB = typeof db;
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
/** Repository functions accept either the db or an open transaction, so callers can group writes. */
export type Executor = DB | Tx;
