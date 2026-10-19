import { describe, expect, it } from 'vitest';
import {
  calculateItemNutrients,
  servingsFor,
  sumNutrients,
} from '../src/modules/nutrition/calorie-calculator.js';

// Per 100 g, typical serving 250 g (like cooked white rice).
const rice = {
  servingSize: 100,
  calories: 130,
  protein: 2.7,
  carbohydrates: 28.2,
  fat: 0.3,
  typicalServingSize: 250,
};

describe('calorie calculator', () => {
  it('converts a portion to reference servings (Sᵢ)', () => {
    expect(servingsFor(rice, { quantity: 150, unit: 'g' })).toBe(1.5);
    expect(servingsFor(rice, { quantity: 200, unit: 'ml' })).toBe(2);
    // 1.5 typical servings = 375 g = 3.75 reference servings
    expect(servingsFor(rice, { quantity: 1.5, unit: 'serving' })).toBe(3.75);
  });

  it('scales every nutrient by the servings (Cᵢ = Sᵢ × Cₛ)', () => {
    expect(calculateItemNutrients(rice, { quantity: 250, unit: 'g' })).toEqual({
      servings: 2.5,
      calories: 325,
      protein: 6.8, // 6.75 rounded
      carbohydrates: 70.5,
      fat: 0.8, // 0.75 rounded
    });
  });

  it('gives zero for a zero portion', () => {
    expect(calculateItemNutrients(rice, { quantity: 0, unit: 'g' }).calories).toBe(0);
  });

  it('sums the items of a meal (C_meal = Σ Cᵢ)', () => {
    const total = sumNutrients([
      { calories: 325, protein: 6.8, carbohydrates: 70.5, fat: 0.8 },
      { calories: 405, protein: 1.9, carbohydrates: 60, fat: 18 },
      { calories: 0.1, protein: 0.2, carbohydrates: 0, fat: 0 },
    ]);

    expect(total).toEqual({ calories: 730.1, protein: 8.9, carbohydrates: 130.5, fat: 18.8 });
    expect(sumNutrients([])).toEqual({ calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  });
});
