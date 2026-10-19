import { describe, expect, it } from 'vitest';
import { calculateDietaryReference } from '../src/modules/profile/dietary-reference.js';

const man = {
  age: 30,
  sex: 'male',
  weightKg: 80,
  heightCm: 180,
  activityLevel: 'moderate',
  weightGoal: 'maintain',
} as const;

describe('calculateDietaryReference', () => {
  it('uses Mifflin–St Jeor and the activity factor', () => {
    // BMR = 10×80 + 6.25×180 − 5×30 + 5 = 1780; × 1.55 = 2759
    expect(calculateDietaryReference(man)).toEqual({
      bmr: 1780,
      maintenanceCalories: 2759,
      dailyCalorieReference: 2759,
    });
  });

  it('adjusts for the weight goal', () => {
    expect(calculateDietaryReference({ ...man, weightGoal: 'lose' }).dailyCalorieReference).toBe(
      2259,
    );
    expect(calculateDietaryReference({ ...man, weightGoal: 'gain' }).dailyCalorieReference).toBe(
      3259,
    );
  });

  it('never goes below the minimum intake when losing weight', () => {
    // BMR = 600 + 1031.25 − 125 − 161 = 1345.25; × 1.2 = 1614.3; − 500 = 1114.3 → 1200 minimum
    const result = calculateDietaryReference({
      age: 25,
      sex: 'female',
      weightKg: 60,
      heightCm: 165,
      activityLevel: 'sedentary',
      weightGoal: 'lose',
    });

    expect(result).toEqual({ bmr: 1345, maintenanceCalories: 1614, dailyCalorieReference: 1200 });
  });

  it('caps the minimum at maintenance for very small bodies', () => {
    const result = calculateDietaryReference({
      age: 90,
      sex: 'female',
      weightKg: 30,
      heightCm: 140,
      activityLevel: 'sedentary',
      weightGoal: 'lose',
    });

    expect(result.dailyCalorieReference).toBe(result.maintenanceCalories);
  });
});
