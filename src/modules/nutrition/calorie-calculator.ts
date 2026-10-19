import type { NutritionalReference, QuantityUnit } from '../../db/schema/index.js';

// Calorie estimation (report §3.5.5): Cᵢ = Sᵢ × Cₛ for each item, C_meal = Σ Cᵢ for the meal.
// The same scaling is applied to protein, carbohydrates and fat.

/** How much of a food was eaten. "serving" means the reference's typical serving. */
export type Portion = { quantity: number; unit: QuantityUnit };

export type Nutrients = { calories: number; protein: number; carbohydrates: number; fat: number };

type ReferenceValues = Pick<
  NutritionalReference,
  'servingSize' | 'calories' | 'protein' | 'carbohydrates' | 'fat' | 'typicalServingSize'
>;

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Sᵢ: the portion as a number of reference servings. Grams and millilitres are treated as equal
 * (density ≈ 1), which is close enough for drinks, soups and stews at this level of estimation.
 */
export function servingsFor(reference: ReferenceValues, { quantity, unit }: Portion) {
  const amount = unit === 'serving' ? quantity * reference.typicalServingSize : quantity;
  return amount / reference.servingSize;
}

/** Nutrients for one food item, rounded to one decimal place. */
export function calculateItemNutrients(reference: ReferenceValues, portion: Portion) {
  const servings = servingsFor(reference, portion);
  return {
    servings: round(servings, 2),
    calories: round(servings * reference.calories, 1),
    protein: round(servings * reference.protein, 1),
    carbohydrates: round(servings * reference.carbohydrates, 1),
    fat: round(servings * reference.fat, 1),
  };
}

/** Totals for a meal: the sum over its items. */
export function sumNutrients(items: Nutrients[]): Nutrients {
  const total = { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };
  for (const item of items) {
    total.calories += item.calories;
    total.protein += item.protein;
    total.carbohydrates += item.carbohydrates;
    total.fat += item.fat;
  }
  return {
    calories: round(total.calories, 1),
    protein: round(total.protein, 1),
    carbohydrates: round(total.carbohydrates, 1),
    fat: round(total.fat, 1),
  };
}
