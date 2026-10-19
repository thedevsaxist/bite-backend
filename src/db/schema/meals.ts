import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { foodAnalyses, quantityUnits, recognisedFoodItems } from './analyses.js';
import { createdAt, id, timestamp, updatedAt } from './columns.js';
import { nutritionalReferences } from './nutrition.js';
import { users } from './users.js';

// "saved" meals count towards intake; "disputed" ones (the user said the result is wrong) don't,
// until the user corrects them.
export const mealRecordStatuses = ['saved', 'disputed'] as const;
export type MealRecordStatus = (typeof mealRecordStatuses)[number];

// Report §3.5.3 "Meal Records": the user's food-intake history. Created from an analysis, either
// automatically (auto-save on) or when the user validates the result. Edits change the meal
// record, never the analysis, so the original AI result stays available for comparison.
export const mealRecords = sqliteTable(
  'meal_records',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // One meal record per analysis.
    analysisId: text()
      .notNull()
      .unique()
      .references(() => foodAnalyses.id, { onDelete: 'cascade' }),
    // When the meal was eaten; defaults to when the photo was analysed.
    mealDate: timestamp().notNull(),
    // Totals of the items with nutrient values, kept here so history and summaries don't need to
    // add up items on every read.
    totalCalories: real().notNull(),
    totalProtein: real().notNull(),
    totalCarbohydrates: real().notNull(),
    totalFat: real().notNull(),
    recordStatus: text({ enum: mealRecordStatuses }).notNull().default('saved'),
    // True once the user has reviewed the result (validated or edited it).
    validatedByUser: integer({ mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('meal_records_user_date_idx').on(t.userId, t.mealDate)],
);

// Report §3.5.3 "Meal Items": the final version of each food in a meal record.
export const mealItems = sqliteTable(
  'meal_items',
  {
    id: id(),
    mealId: text()
      .notNull()
      .references(() => mealRecords.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    // The AI-recognised item this came from; null for items the user added.
    recognisedItemId: text().references(() => recognisedFoodItems.id, { onDelete: 'set null' }),
    foodName: text().notNull(),
    // Kept so nutrients can be recalculated when the portion is edited.
    nutritionReferenceId: text().references(() => nutritionalReferences.id, {
      onDelete: 'set null',
    }),
    portionQuantity: real(),
    portionUnit: text({ enum: quantityUnits }),
    // Null when the food has no reference values and the user entered none.
    calories: real(),
    protein: real(),
    carbohydrates: real(),
    fat: real(),
    // True when the user changed this item from what the AI recognised, or added it.
    wasModified: integer({ mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('meal_items_meal_idx').on(t.mealId)],
);

export type MealRecord = typeof mealRecords.$inferSelect;
export type NewMealRecord = typeof mealRecords.$inferInsert;
export type MealItem = typeof mealItems.$inferSelect;
export type NewMealItem = typeof mealItems.$inferInsert;
