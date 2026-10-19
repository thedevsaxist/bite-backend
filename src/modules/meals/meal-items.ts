import type {
  NewMealItem,
  NutritionalReference,
  RecognisedFoodItem,
} from '../../db/schema/index.js';
import { AppError } from '../../utils/app-error.js';
import {
  calculateItemNutrients,
  sumNutrients,
  type Nutrients,
} from '../nutrition/calorie-calculator.js';
import type { MealItemInput } from './meals.schemas.js';

// Builds the final meal items, either straight from the AI-recognised items or from the user's
// corrections, and recalculates nutrients whenever a portion or food changes (report §3.5.5).

export type MealItemDraft = Omit<NewMealItem, 'mealId'>;

const nutrientsOf = (item: MealItemDraft): Nutrients | null =>
  item.calories === null || item.calories === undefined
    ? null
    : {
        calories: item.calories,
        protein: item.protein ?? 0,
        carbohydrates: item.carbohydrates ?? 0,
        fat: item.fat ?? 0,
      };

/** Totals over the items with nutrient values. */
export function mealTotals(items: MealItemDraft[]) {
  return sumNutrients(items.flatMap((item) => nutrientsOf(item) ?? []));
}

/** The meal exactly as the AI recognised it. */
export function itemsFromAnalysis(recognised: RecognisedFoodItem[]): MealItemDraft[] {
  return recognised.map((item, position) => ({
    position,
    recognisedItemId: item.id,
    foodName: item.foodName,
    nutritionReferenceId: item.nutritionReferenceId,
    portionQuantity: item.estimatedQuantity,
    portionUnit: item.quantityUnit,
    calories: item.calories,
    protein: item.protein,
    carbohydrates: item.carbohydrates,
    fat: item.fat,
    wasModified: false,
  }));
}

const badItem = (index: number, message: string, code: string) =>
  new AppError(400, message, code, { path: `items.${index}` });

/**
 * The meal as the user corrected it. Every item is checked against the analysis it belongs to and
 * the reference data before anything is saved.
 */
export function itemsFromEdits(
  edits: MealItemInput[],
  recognisedById: Map<string, RecognisedFoodItem>,
  referencesById: Map<string, NutritionalReference>,
): MealItemDraft[] {
  return edits.map((edit, position) => {
    const recognised = edit.recognisedItemId
      ? recognisedById.get(edit.recognisedItemId)
      : undefined;
    if (edit.recognisedItemId && !recognised) {
      throw badItem(
        position,
        'This item is not part of the analysed meal',
        'UNKNOWN_RECOGNISED_ITEM',
      );
    }

    const referenceId = edit.nutritionReferenceId ?? null;
    const reference = referenceId ? referencesById.get(referenceId) : undefined;
    if (referenceId && !reference) {
      throw badItem(position, 'Unknown reference food', 'UNKNOWN_NUTRITION_REFERENCE');
    }
    if (!reference && edit.unit === 'serving' && edit.calories === undefined) {
      throw badItem(
        position,
        'A food without reference data needs a weight, or its calories',
        'PORTION_NEEDS_REFERENCE',
      );
    }

    const portion = { quantity: edit.quantity, unit: edit.unit };
    const nutrients = reference
      ? calculateItemNutrients(reference, portion)
      : edit.calories !== undefined
        ? {
            calories: edit.calories,
            protein: edit.protein ?? 0,
            carbohydrates: edit.carbohydrates ?? 0,
            fat: edit.fat ?? 0,
          }
        : null;

    const unchanged =
      recognised !== undefined &&
      edit.name === recognised.foodName &&
      referenceId === recognised.nutritionReferenceId &&
      edit.quantity === recognised.estimatedQuantity &&
      edit.unit === recognised.quantityUnit &&
      edit.calories === undefined;

    return {
      position,
      recognisedItemId: recognised?.id ?? null,
      foodName: edit.name,
      nutritionReferenceId: reference?.id ?? null,
      portionQuantity: edit.quantity,
      portionUnit: edit.unit,
      calories: nutrients?.calories ?? null,
      protein: nutrients?.protein ?? null,
      carbohydrates: nutrients?.carbohydrates ?? null,
      fat: nutrients?.fat ?? null,
      wasModified: !unchanged,
    };
  });
}
