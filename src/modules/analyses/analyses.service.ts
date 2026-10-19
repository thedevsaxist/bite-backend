import type { FoodAnalysis, RecognisedFoodItem } from '../../db/schema/index.js';
import { AppError } from '../../utils/app-error.js';
import { sumNutrients, type Nutrients } from '../nutrition/calorie-calculator.js';
import { analyseMealPhoto } from './analysis-pipeline.js';
import { analysesRepository } from './analyses.repository.js';
import { imageUrl, readImage } from './image-storage.js';

type ItemRow = ReturnType<typeof analysesRepository.findItems>[number];

const analysisNotFound = () => new AppError(404, 'Analysis not found', 'ANALYSIS_NOT_FOUND');

/** Nutrient values, or null for an item no reference food matched. */
function itemNutrients(item: RecognisedFoodItem): Nutrients | null {
  const { calories, protein, carbohydrates, fat } = item;
  if (calories === null || protein === null || carbohydrates === null || fat === null) return null;
  return { calories, protein, carbohydrates, fat };
}

function toPublicItem({ item, reference }: ItemRow) {
  return {
    id: item.id,
    name: item.foodName,
    nutritionReference: reference,
    portion: {
      description: item.portionDescription,
      quantity: item.estimatedQuantity,
      unit: item.quantityUnit,
    },
    confidence: item.recognitionConfidence,
    nutrients: itemNutrients(item),
  };
}

async function toPublicAnalysis(analysis: FoodAnalysis, rows: ItemRow[]) {
  const items = rows.map(toPublicItem);
  const matched = items.flatMap((item) => (item.nutrients ? [item.nutrients] : []));
  const completed = analysis.analysisStatus === 'completed';

  return {
    id: analysis.id,
    status: analysis.analysisStatus,
    additionalContext: analysis.additionalContext,
    // A signed link when photos are in Supabase; null for local storage (use GET /analyses/:id/image).
    imageUrl: await imageUrl(analysis.imageReference),
    items,
    // Totals cover matched items only; unmatchedItemCount says how many were left out.
    totals: completed ? sumNutrients(matched) : null,
    unmatchedItemCount: items.length - matched.length,
    ai: {
      provider: analysis.aiProvider,
      model: analysis.aiModel,
      inputTokens: analysis.aiInputTokens,
      outputTokens: analysis.aiOutputTokens,
    },
    failureReason: analysis.failureReason,
    processingTimeMs: analysis.processingTimeMs,
    analysedAt: analysis.analysedAt,
    createdAt: analysis.createdAt,
  };
}

export const analysesService = {
  /** Runs the analysis pipeline on an uploaded photo and returns the stored analysis. */
  async create(userId: string, photo: Buffer, context?: string) {
    const id = await analyseMealPhoto(userId, photo, context);
    // Stage 9: save it to the food-intake history here when auto-save is on.
    return analysesService.getForUser(userId, id);
  },

  async getForUser(userId: string, id: string) {
    const analysis = analysesRepository.findForUser(id, userId);
    if (!analysis) throw analysisNotFound();
    return { analysis: await toPublicAnalysis(analysis, analysesRepository.findItems(id)) };
  },

  /** The analysis's photo as JPEG bytes. */
  async getImage(userId: string, id: string) {
    const analysis = analysesRepository.findForUser(id, userId);
    if (!analysis) throw analysisNotFound();
    const image = await readImage(analysis.imageReference);
    if (!image) throw new AppError(404, 'The photo for this analysis is gone', 'IMAGE_NOT_FOUND');
    return image;
  },
};
