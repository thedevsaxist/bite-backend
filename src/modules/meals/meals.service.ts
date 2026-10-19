import { db, type Executor } from '../../db/index.js';
import { isUniqueConstraintError } from '../../db/errors.js';
import type { MealRecord } from '../../db/schema/index.js';
import { AppError } from '../../utils/app-error.js';
import { analysesRepository } from '../analyses/analyses.repository.js';
import { imageUrl, imageUrls } from '../analyses/image-storage.js';
import { nutritionRepository } from '../nutrition/nutrition.repository.js';
import { itemsFromAnalysis, itemsFromEdits, mealTotals, type MealItemDraft } from './meal-items.js';
import type { ListMealsQuery, MealChanges, MealItemInput } from './meals.schemas.js';
import { mealsRepository } from './meals.repository.js';

type ItemRow = ReturnType<typeof mealsRepository.findItems>[number];

const DEFAULT_HISTORY_DAYS = 30;

const mealNotFound = () => new AppError(404, 'Meal not found', 'MEAL_NOT_FOUND');

const totalColumns = (items: MealItemDraft[]) => {
  const totals = mealTotals(items);
  return {
    totalCalories: totals.calories,
    totalProtein: totals.protein,
    totalCarbohydrates: totals.carbohydrates,
    totalFat: totals.fat,
  };
};

function toPublicItem({ item, reference }: ItemRow) {
  return {
    id: item.id,
    name: item.foodName,
    recognisedItemId: item.recognisedItemId,
    nutritionReference: reference,
    portion: { quantity: item.portionQuantity, unit: item.portionUnit },
    nutrients:
      item.calories === null
        ? null
        : {
            calories: item.calories,
            protein: item.protein ?? 0,
            carbohydrates: item.carbohydrates ?? 0,
            fat: item.fat ?? 0,
          },
    wasModified: item.wasModified,
  };
}

function toPublicMeal(meal: MealRecord, rows: ItemRow[]) {
  const items = rows.map(toPublicItem);
  return {
    id: meal.id,
    analysisId: meal.analysisId,
    mealDate: meal.mealDate,
    status: meal.recordStatus,
    validatedByUser: meal.validatedByUser,
    totals: {
      calories: meal.totalCalories,
      protein: meal.totalProtein,
      carbohydrates: meal.totalCarbohydrates,
      fat: meal.totalFat,
    },
    unmatchedItemCount: items.filter((item) => item.nutrients === null).length,
    items,
    createdAt: meal.createdAt,
    updatedAt: meal.updatedAt,
  };
}

/** Checks the user's edits against the analysis and reference data, and builds the items. */
function itemsFromChanges(analysisId: string, edits: MealItemInput[]) {
  const recognised = analysesRepository.findItems(analysisId).map((row) => row.item);
  const referenceIds = edits.flatMap((edit) =>
    edit.nutritionReferenceId ? [edit.nutritionReferenceId] : [],
  );
  return itemsFromEdits(
    edits,
    new Map(recognised.map((item) => [item.id, item])),
    new Map(nutritionRepository.findByIds(referenceIds).map((ref) => [ref.id, ref])),
  );
}

export const mealsService = {
  /**
   * Saves a completed analysis to the food-intake history: automatically when auto-save is on,
   * or when the user validates the result (optionally with corrections).
   */
  createFromAnalysis(
    userId: string,
    analysisId: string,
    { changes = {}, validatedByUser }: { changes?: MealChanges; validatedByUser: boolean },
  ) {
    const analysis = analysesRepository.findForUser(analysisId, userId);
    if (!analysis) throw new AppError(404, 'Analysis not found', 'ANALYSIS_NOT_FOUND');
    if (analysis.analysisStatus !== 'completed') {
      throw new AppError(409, 'Only a completed analysis can be saved', 'ANALYSIS_NOT_COMPLETED');
    }
    const alreadySaved = () => {
      const existing = mealsRepository.findByAnalysis(analysisId);
      return new AppError(409, 'This analysis is already saved as a meal', 'MEAL_ALREADY_SAVED', {
        mealId: existing?.id,
      });
    };
    if (mealsRepository.findByAnalysis(analysisId)) throw alreadySaved();

    const items = changes.items
      ? itemsFromChanges(analysisId, changes.items)
      : itemsFromAnalysis(analysesRepository.findItems(analysisId).map((row) => row.item));

    try {
      return db.transaction((tx) => {
        const meal = mealsRepository.create(
          {
            userId,
            analysisId,
            mealDate: changes.mealDate ?? analysis.createdAt,
            ...totalColumns(items),
            validatedByUser,
          },
          tx,
        );
        mealsRepository.replaceItems(meal.id, items, tx);
        return meal;
      });
    } catch (err) {
      // Two requests saved the same analysis at once.
      if (isUniqueConstraintError(err)) throw alreadySaved();
      throw err;
    }
  },

  async get(userId: string, id: string) {
    const found = mealsRepository.findForUser(id, userId);
    if (!found) throw mealNotFound();
    return {
      meal: {
        ...toPublicMeal(found.meal, mealsRepository.findItems([id])),
        // A signed link when photos are in Supabase; null for local storage.
        imageUrl: await imageUrl(found.imageReference),
      },
    };
  },

  /** The food-intake history: meals eaten in the range (default: the last 30 days), newest first. */
  async list(userId: string, { from, to, limit }: ListMealsQuery) {
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - DEFAULT_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    const meals = mealsRepository.listForUser(userId, { from: start, to: end, limit });
    const mealIds = meals.map((meal) => meal.id);

    const rowsByMeal = new Map<string, ItemRow[]>();
    for (const row of mealsRepository.findItems(mealIds)) {
      rowsByMeal.set(row.item.mealId, [...(rowsByMeal.get(row.item.mealId) ?? []), row]);
    }

    // One signing request for the whole page of meals.
    const references = mealsRepository.findImageReferences(mealIds);
    const links = await imageUrls(references.map((row) => row.imageReference));
    const linkByMeal = new Map(references.map((row, index) => [row.mealId, links[index]]));

    return {
      meals: meals.map((meal) => ({
        ...toPublicMeal(meal, rowsByMeal.get(meal.id) ?? []),
        imageUrl: linkByMeal.get(meal.id) ?? null,
      })),
      range: { from: start, to: end },
    };
  },

  /**
   * Applies the user's corrections. Sending no changes confirms the meal as it is. Either way the
   * meal counts as reviewed, and a disputed meal is restored.
   */
  async update(userId: string, id: string, changes: MealChanges) {
    const found = mealsRepository.findForUser(id, userId);
    if (!found) throw mealNotFound();
    const items = changes.items ? itemsFromChanges(found.meal.analysisId, changes.items) : null;

    db.transaction((tx) => {
      if (items) mealsRepository.replaceItems(id, items, tx);
      mealsRepository.update(
        id,
        {
          ...(changes.mealDate ? { mealDate: changes.mealDate } : {}),
          ...(items ? totalColumns(items) : {}),
          recordStatus: 'saved',
          validatedByUser: true,
        },
        tx,
      );
    });
    return mealsService.get(userId, id);
  },

  delete(userId: string, id: string) {
    if (!mealsRepository.findForUser(id, userId)) throw mealNotFound();
    // The analysis (and its original AI result) is kept; it can be saved again later.
    mealsRepository.delete(id);
  },

  /** Takes the meal made from a disputed analysis out of the intake totals. */
  markDisputed(analysisId: string, executor: Executor = db) {
    const meal = mealsRepository.findByAnalysis(analysisId, executor);
    if (meal) mealsRepository.update(meal.id, { recordStatus: 'disputed' }, executor);
  },

  /** The meal saved from an analysis, if any, for showing alongside the analysis. */
  savedMealFor(analysisId: string) {
    const meal = mealsRepository.findByAnalysis(analysisId);
    return meal
      ? { id: meal.id, status: meal.recordStatus, validatedByUser: meal.validatedByUser }
      : null;
  },
};
