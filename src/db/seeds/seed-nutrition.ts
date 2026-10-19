import { sql } from 'drizzle-orm';
import { db, type Executor } from '../index.js';
import { nutritionalReferences } from '../schema/index.js';
import { nutritionReferenceSeed } from './nutrition-references.js';

/**
 * Inserts the reference foods, updating rows whose key already exists, so it is safe to run
 * repeatedly. Rows removed from the seed file are left in place, since analyses may refer to them.
 */
export function seedNutritionReferences(executor: Executor = db) {
  if (nutritionReferenceSeed.length === 0) return 0;

  executor
    .insert(nutritionalReferences)
    .values(nutritionReferenceSeed)
    .onConflictDoUpdate({
      target: nutritionalReferences.key,
      // excluded.* is the row that failed to insert, i.e. the new values from the seed file.
      set: {
        foodName: sql`excluded.food_name`,
        aliases: sql`excluded.aliases`,
        servingSize: sql`excluded.serving_size`,
        servingUnit: sql`excluded.serving_unit`,
        calories: sql`excluded.calories`,
        protein: sql`excluded.protein`,
        carbohydrates: sql`excluded.carbohydrates`,
        fat: sql`excluded.fat`,
        typicalServingSize: sql`excluded.typical_serving_size`,
        typicalServingLabel: sql`excluded.typical_serving_label`,
        source: sql`excluded.source`,
        updatedAt: new Date(),
      },
    })
    .run();

  return nutritionReferenceSeed.length;
}
