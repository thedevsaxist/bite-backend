import type { ActivityLevel, Sex, WeightGoal } from '../../db/schema/index.js';

// Daily calorie reference (report §3.4.1 FR 4). A basic estimate, not dietary advice:
// Mifflin–St Jeor BMR × activity factor, then adjusted for the user's weight goal.

const activityFactors: Record<ActivityLevel, number> = {
  sedentary: 1.2, // little or no exercise
  light: 1.375, // light exercise 1–3 days a week
  moderate: 1.55, // moderate exercise 3–5 days a week
  active: 1.725, // hard exercise 6–7 days a week
  very_active: 1.9, // physical job or training twice a day
};

// About 0.5 kg a week either way.
const goalAdjustments: Record<WeightGoal, number> = {
  lose: -500,
  maintain: 0,
  gain: 500,
};

// Commonly cited minimum daily intakes without medical supervision.
const minimumCalories: Record<Sex, number> = {
  male: 1500,
  female: 1200,
};

export type DietaryInputs = {
  age: number;
  sex: Sex;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  weightGoal: WeightGoal;
};

export function calculateDietaryReference(inputs: DietaryInputs) {
  const { age, sex, weightKg, heightCm, activityLevel, weightGoal } = inputs;

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
  const maintenance = bmr * activityFactors[activityLevel];
  const target = maintenance + goalAdjustments[weightGoal];
  // Never go below the minimum, unless maintenance itself is lower (very small bodies).
  const floor = Math.min(minimumCalories[sex], maintenance);

  return {
    bmr: Math.round(bmr),
    maintenanceCalories: Math.round(maintenance),
    dailyCalorieReference: Math.round(Math.max(target, floor)),
  };
}
