import { asc, eq, inArray, or, sql, type AnyColumn } from 'drizzle-orm';
import { db, type Executor } from '../../db/index.js';
import { nutritionalReferences } from '../../db/schema/index.js';

/** Escapes LIKE wildcards so a search for "50%" matches the text "50%", not everything. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

// SQLite's LIKE is case-insensitive for ASCII, which is what we want for food names.
const like = (column: AnyColumn, pattern: string) => sql`${column} LIKE ${pattern} ESCAPE '\\'`;

export const nutritionRepository = {
  /** Foods whose name or aliases contain `query`; names that start with it come first. */
  search(query: string | undefined, limit: number, executor: Executor = db) {
    const base = executor.select().from(nutritionalReferences);
    if (!query) {
      return base.orderBy(asc(nutritionalReferences.foodName)).limit(limit).all();
    }

    const contains = `%${escapeLike(query)}%`;
    const startsWith = `${escapeLike(query)}%`;
    return base
      .where(
        or(
          like(nutritionalReferences.foodName, contains),
          like(nutritionalReferences.aliases, contains),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${like(nutritionalReferences.foodName, startsWith)} THEN 0 ELSE 1 END`,
        asc(nutritionalReferences.foodName),
      )
      .limit(limit)
      .all();
  },

  /** Every reference food's key, name and aliases: the catalog the AI model maps items to. */
  listCatalog(executor: Executor = db) {
    return executor
      .select({
        id: nutritionalReferences.id,
        key: nutritionalReferences.key,
        name: nutritionalReferences.foodName,
        aliases: nutritionalReferences.aliases,
      })
      .from(nutritionalReferences)
      .orderBy(asc(nutritionalReferences.key))
      .all();
  },

  findByKeys(keys: string[], executor: Executor = db) {
    if (keys.length === 0) return [];
    return executor
      .select()
      .from(nutritionalReferences)
      .where(inArray(nutritionalReferences.key, keys))
      .all();
  },

  findByIds(ids: string[], executor: Executor = db) {
    if (ids.length === 0) return [];
    return executor
      .select()
      .from(nutritionalReferences)
      .where(inArray(nutritionalReferences.id, ids))
      .all();
  },

  findById(id: string, executor: Executor = db) {
    return executor
      .select()
      .from(nutritionalReferences)
      .where(eq(nutritionalReferences.id, id))
      .get();
  },
};
