import type { NutritionalReference } from '../../db/schema/index.js';
import type { RecognisedItem } from '../../integrations/ai/index.js';
import { calculateItemNutrients, type Portion } from '../nutrition/calorie-calculator.js';

// Turns recognised items into calorie estimates (report §3.5.5). Pure, so the analysis pipeline
// and the evaluation (src/evaluation/) calculate calories in exactly the same way.

/**
 * How much was eaten. Without a weight estimate, a matched food is assumed to be one typical
 * serving, recorded as "1 serving" so the user can see and correct it.
 */
function portionFor(
  item: RecognisedItem,
  reference: NutritionalReference | undefined,
): Portion | null {
  if (item.estimatedGrams !== null) return { quantity: item.estimatedGrams, unit: 'g' };
  return reference ? { quantity: 1, unit: 'serving' } : null;
}

/** Each item with its matched reference food, portion and nutrients (`references` keyed by key). */
export function estimateItems(
  items: RecognisedItem[],
  references: Map<string, NutritionalReference>,
) {
  return items.map((item) => {
    const reference = item.nutritionKey ? references.get(item.nutritionKey) : undefined;
    const portion = portionFor(item, reference);
    // Unmatched items get no nutrient values rather than a made-up one.
    const nutrients = reference && portion ? calculateItemNutrients(reference, portion) : null;
    return { item, reference, portion, nutrients };
  });
}
