import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db, type Executor } from '../../db/index.js';
import {
  foodAnalyses,
  mealItems,
  mealRecords,
  nutritionalReferences,
  type MealRecordStatus,
  type NewMealItem,
  type NewMealRecord,
} from '../../db/schema/index.js';

export const mealsRepository = {
  create(data: NewMealRecord, executor: Executor = db) {
    return executor.insert(mealRecords).values(data).returning().get();
  },

  update(id: string, data: Partial<NewMealRecord>, executor: Executor = db) {
    return executor.update(mealRecords).set(data).where(eq(mealRecords.id, id)).returning().get();
  },

  delete(id: string, executor: Executor = db) {
    executor.delete(mealRecords).where(eq(mealRecords.id, id)).run();
  },

  /** Replaces all items of a meal. */
  replaceItems(mealId: string, items: Omit<NewMealItem, 'mealId'>[], executor: Executor = db) {
    executor.delete(mealItems).where(eq(mealItems.mealId, mealId)).run();
    if (items.length > 0) {
      executor
        .insert(mealItems)
        .values(items.map((item) => ({ ...item, mealId })))
        .run();
    }
  },

  /** The meal with its photo reference, only if it belongs to `userId`. */
  findForUser(id: string, userId: string, executor: Executor = db) {
    return executor
      .select({ meal: mealRecords, imageReference: foodAnalyses.imageReference })
      .from(mealRecords)
      .innerJoin(foodAnalyses, eq(mealRecords.analysisId, foodAnalyses.id))
      .where(and(eq(mealRecords.id, id), eq(mealRecords.userId, userId)))
      .get();
  },

  findByAnalysis(analysisId: string, executor: Executor = db) {
    return executor.select().from(mealRecords).where(eq(mealRecords.analysisId, analysisId)).get();
  },

  findItems(mealIds: string[], executor: Executor = db) {
    if (mealIds.length === 0) return [];
    return executor
      .select({
        item: mealItems,
        reference: {
          id: nutritionalReferences.id,
          key: nutritionalReferences.key,
          name: nutritionalReferences.foodName,
        },
      })
      .from(mealItems)
      .leftJoin(nutritionalReferences, eq(mealItems.nutritionReferenceId, nutritionalReferences.id))
      .where(inArray(mealItems.mealId, mealIds))
      .orderBy(asc(mealItems.position))
      .all();
  },

  /** The user's meals eaten between `from` and `to` (inclusive), newest first. */
  listForUser(
    userId: string,
    {
      from,
      to,
      limit,
      status,
    }: { from: Date; to: Date; limit?: number; status?: MealRecordStatus },
    executor: Executor = db,
  ) {
    const query = executor
      .select()
      .from(mealRecords)
      .where(
        and(
          eq(mealRecords.userId, userId),
          gte(mealRecords.mealDate, from),
          lte(mealRecords.mealDate, to),
          status ? eq(mealRecords.recordStatus, status) : undefined,
        ),
      )
      .orderBy(desc(mealRecords.mealDate));
    return limit ? query.limit(limit).all() : query.all();
  },
};
