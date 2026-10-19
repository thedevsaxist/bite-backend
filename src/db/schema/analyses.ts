import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, id, timestamp } from './columns.js';
import { nutritionalReferences } from './nutrition.js';
import { users } from './users.js';

export const analysisStatuses = ['processing', 'completed', 'failed'] as const;
export type AnalysisStatus = (typeof analysisStatuses)[number];

export const quantityUnits = ['g', 'ml', 'serving'] as const;
export type QuantityUnit = (typeof quantityUnits)[number];

// Report §3.5.3 "Food Analyses": one analysis of one submitted photo. It keeps the original AI
// result unchanged; the user's corrected version is stored separately as a meal record (stage 9).
export const foodAnalyses = sqliteTable(
  'food_analyses',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Object path in photo storage, e.g. "<userId>/<uuid>.jpg".
    imageReference: text().notNull(),
    // Optional meal information the user typed in (ingredients, portion sizes).
    additionalContext: text(),
    analysisStatus: text({ enum: analysisStatuses }).notNull().default('processing'),
    // The AI provider's structured response, exactly as received.
    aiResult: text({ mode: 'json' }).$type<unknown>(),
    aiProvider: text(),
    aiModel: text(),
    // Error code when analysisStatus is "failed", e.g. "NO_FOOD_DETECTED".
    failureReason: text(),
    // Time the AI call took, for the response-time evaluation (report objective 4).
    processingTimeMs: integer(),
    analysedAt: timestamp(),
    createdAt: createdAt(),
  },
  (t) => [index('food_analyses_user_created_idx').on(t.userId, t.createdAt)],
);

// Report §3.5.3 "Recognised Food Items": the food components found in one analysis.
// Nutrient values are calculated when the analysis runs and stored, so the analysis stays as it
// was even if the nutrition reference data is corrected later.
export const recognisedFoodItems = sqliteTable(
  'recognised_food_items',
  {
    id: id(),
    analysisId: text()
      .notNull()
      .references(() => foodAnalyses.id, { onDelete: 'cascade' }),
    // Order in which the model listed the items.
    position: integer().notNull(),
    foodName: text().notNull(),
    // Null when no reference food matched; the item then has no nutrient values (report §3.5.5).
    nutritionReferenceId: text().references(() => nutritionalReferences.id, {
      onDelete: 'set null',
    }),
    portionDescription: text(),
    estimatedQuantity: real(),
    quantityUnit: text({ enum: quantityUnits }),
    // 0–1, where the model reports it.
    recognitionConfidence: real(),
    calories: real(),
    protein: real(),
    carbohydrates: real(),
    fat: real(),
  },
  (t) => [index('recognised_food_items_analysis_idx').on(t.analysisId)],
);

export type FoodAnalysis = typeof foodAnalyses.$inferSelect;
export type NewFoodAnalysis = typeof foodAnalyses.$inferInsert;
export type RecognisedFoodItem = typeof recognisedFoodItems.$inferSelect;
export type NewRecognisedFoodItem = typeof recognisedFoodItems.$inferInsert;
