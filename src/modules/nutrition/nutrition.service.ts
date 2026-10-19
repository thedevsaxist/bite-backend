import type { NutritionalReference } from '../../db/schema/index.js';
import { AppError } from '../../utils/app-error.js';
import type { SearchFoodsQuery } from './nutrition.schemas.js';
import { nutritionRepository } from './nutrition.repository.js';

export function toPublicFood(food: NutritionalReference) {
  return {
    id: food.id,
    key: food.key,
    name: food.foodName,
    aliases: food.aliases,
    servingSize: food.servingSize,
    servingUnit: food.servingUnit,
    calories: food.calories,
    protein: food.protein,
    carbohydrates: food.carbohydrates,
    fat: food.fat,
    typicalServing: { size: food.typicalServingSize, label: food.typicalServingLabel },
    source: food.source,
  };
}

export const nutritionService = {
  search({ q, limit }: SearchFoodsQuery) {
    return { foods: nutritionRepository.search(q, limit).map(toPublicFood) };
  },

  getById(id: string) {
    const food = nutritionRepository.findById(id);
    if (!food) throw new AppError(404, 'Food not found', 'FOOD_NOT_FOUND');
    return { food: toPublicFood(food) };
  },
};
