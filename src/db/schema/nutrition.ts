import { real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, id, updatedAt } from './columns.js';

export const servingUnits = ['g', 'ml'] as const;
export type ServingUnit = (typeof servingUnits)[number];

// Report §3.5.3 "Nutritional References": reference values the calorie estimate is calculated from.
// Seeded from src/db/seeds/nutrition-references.ts (`npm run db:seed`).
export const nutritionalReferences = sqliteTable('nutritional_references', {
  id: id(),
  // Stable identifier the AI model maps recognised items to, e.g. "jollof_rice".
  key: text().notNull().unique(),
  foodName: text().notNull(),
  // Other names for the same food, used by search (e.g. "dodo" for fried plantain).
  aliases: text({ mode: 'json' })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
  // The nutrient values below are for this amount.
  servingSize: real().notNull(),
  servingUnit: text({ enum: servingUnits }).notNull(),
  calories: real().notNull(),
  protein: real().notNull(),
  carbohydrates: real().notNull(),
  fat: real().notNull(),
  // A typical portion, so a portion of "1 serving" can be converted to grams.
  typicalServingSize: real().notNull(),
  typicalServingLabel: text().notNull(),
  source: text().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type NutritionalReference = typeof nutritionalReferences.$inferSelect;
export type NewNutritionalReference = typeof nutritionalReferences.$inferInsert;
