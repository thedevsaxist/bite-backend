import { and, asc, eq } from 'drizzle-orm';
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
};
