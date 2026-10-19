import { and, asc, eq, lt } from 'drizzle-orm';
import { db, type Executor } from '../../db/index.js';
import {
  foodAnalyses,
  nutritionalReferences,
  recognisedFoodItems,
  type NewFoodAnalysis,
  type NewRecognisedFoodItem,
} from '../../db/schema/index.js';

export const analysesRepository = {
  create(data: NewFoodAnalysis, executor: Executor = db) {
    return executor.insert(foodAnalyses).values(data).returning().get();
  },

  update(id: string, data: Partial<NewFoodAnalysis>, executor: Executor = db) {
    return executor.update(foodAnalyses).set(data).where(eq(foodAnalyses.id, id)).returning().get();
  },

  createItems(items: NewRecognisedFoodItem[], executor: Executor = db) {
    if (items.length === 0) return [];
    return executor.insert(recognisedFoodItems).values(items).returning().all();
  },

  /** The analysis, only if it belongs to `userId`. */
  findForUser(id: string, userId: string, executor: Executor = db) {
    return executor
      .select()
      .from(foodAnalyses)
      .where(and(eq(foodAnalyses.id, id), eq(foodAnalyses.userId, userId)))
      .get();
  },

  /** The analysis's items in the order the model listed them, with their matched reference food. */
  findItems(analysisId: string, executor: Executor = db) {
    return executor
      .select({
        item: recognisedFoodItems,
        reference: {
          id: nutritionalReferences.id,
          key: nutritionalReferences.key,
          name: nutritionalReferences.foodName,
        },
      })
      .from(recognisedFoodItems)
      .leftJoin(
        nutritionalReferences,
        eq(recognisedFoodItems.nutritionReferenceId, nutritionalReferences.id),
      )
      .where(eq(recognisedFoodItems.analysisId, analysisId))
      .orderBy(asc(recognisedFoodItems.position))
      .all();
  },

  /** Every photo the user has stored, for deleting them with the account. */
  listImageReferences(userId: string, executor: Executor = db) {
    return executor
      .select({ imageReference: foodAnalyses.imageReference })
      .from(foodAnalyses)
      .where(eq(foodAnalyses.userId, userId))
      .all()
      .map((row) => row.imageReference);
  },

  /** Marks analyses still "processing" since before `before` as failed; returns how many. */
  failStale(before: Date, executor: Executor = db) {
    return executor
      .update(foodAnalyses)
      .set({ analysisStatus: 'failed', failureReason: 'INTERRUPTED', analysedAt: new Date() })
      .where(and(eq(foodAnalyses.analysisStatus, 'processing'), lt(foodAnalyses.createdAt, before)))
      .returning({ id: foodAnalyses.id })
      .all().length;
  },
};
