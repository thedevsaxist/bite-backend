import type { DietaryReference, MealRecord } from '../../db/schema/index.js';
import { mealsRepository } from '../meals/meals.repository.js';
import { sumNutrients } from '../nutrition/calorie-calculator.js';
import { profileRepository } from '../profile/profile.repository.js';
import { datesBetween, localDate, utcWindow } from './local-dates.js';
import type { DailySummaryQuery, RangeSummaryQuery } from './summary.schemas.js';

// Intake compared with the daily calorie reference (report §3.4.1 FR 18–19). Only saved meals
// count; disputed ones are left out until the user corrects them.

const mealNutrients = (meal: MealRecord) => ({
  calories: meal.totalCalories,
  protein: meal.totalProtein,
  carbohydrates: meal.totalCarbohydrates,
  fat: meal.totalFat,
});

/**
 * The reference that applied on `date`: the latest one calculated on or before that day. Days
 * before the profile was set up have none.
 */
function referenceOn(date: string, references: DietaryReference[], timezone: string) {
  let applicable: DietaryReference | undefined;
  for (const reference of references) {
    if (localDate(reference.calculatedAt, timezone) <= date) applicable = reference;
  }
  return applicable?.dailyCalorieReference ?? null;
}

function daySummary(date: string, meals: MealRecord[], dailyCalorieReference: number | null) {
  const totals = sumNutrients(meals.map(mealNutrients));
  return {
    date,
    totals,
    mealCount: meals.length,
    dailyCalorieReference,
    remainingCalories:
      dailyCalorieReference === null
        ? null
        : Math.round((dailyCalorieReference - totals.calories) * 10) / 10,
    percentOfReference:
      dailyCalorieReference === null
        ? null
        : Math.round((totals.calories / dailyCalorieReference) * 100),
  };
}

export const summaryService = {
  /** One entry per day from `from` to `to`, plus totals and averages over the logged days. */
  range(userId: string, { from, to, timezone }: RangeSummaryQuery) {
    const window = utcWindow(from, to);
    const meals = mealsRepository.listForUser(userId, {
      from: window.start,
      to: window.end,
      status: 'saved',
    });
    const references = profileRepository.listReferences(userId);

    const mealsByDate = new Map<string, MealRecord[]>();
    for (const meal of meals) {
      const date = localDate(meal.mealDate, timezone);
      mealsByDate.set(date, [...(mealsByDate.get(date) ?? []), meal]);
    }

    const days = datesBetween(from, to).map((date) =>
      daySummary(date, mealsByDate.get(date) ?? [], referenceOn(date, references, timezone)),
    );
    const logged = days.filter((day) => day.mealCount > 0);
    const totals = sumNutrients(logged.map((day) => day.totals));
    const average = (value: number) =>
      logged.length === 0 ? 0 : Math.round((value / logged.length) * 10) / 10;

    return {
      from,
      to,
      timezone,
      days,
      totals,
      loggedDays: logged.length,
      // Averages over the days with at least one meal, so unlogged days don't drag them down.
      averagePerLoggedDay: {
        calories: average(totals.calories),
        protein: average(totals.protein),
        carbohydrates: average(totals.carbohydrates),
        fat: average(totals.fat),
      },
    };
  },

  daily(userId: string, { date, timezone }: DailySummaryQuery) {
    const [day] = summaryService.range(userId, { from: date, to: date, timezone }).days;
    return { timezone, ...day! };
  },
};
