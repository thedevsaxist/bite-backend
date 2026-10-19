import { performance } from 'node:perf_hooks';
import { db } from '../../db/index.js';
import type { NewRecognisedFoodItem, NutritionalReference } from '../../db/schema/index.js';
import {
  foodRecognitionProvider,
  type RecognisedItem,
  type RecognitionResult,
} from '../../integrations/ai/index.js';
import { AppError } from '../../utils/app-error.js';
import { nutritionRepository } from '../nutrition/nutrition.repository.js';
import { analysesRepository } from './analyses.repository.js';
import { estimateItems } from './estimate-items.js';
import { prepareImage } from './image-processing.js';
import { deleteImage, saveImage } from './image-storage.js';

// The analysis pipeline (report §3.5.1, §3.5.4, §3.5.5):
// validate photo → store it → AI recognition → match nutrition references → calculate → store.
// Every analysis that reaches the AI call is recorded, including failed ones, so they can be
// reviewed and counted in the evaluation.

/** An error for the client that also says which stored analysis it belongs to. */
const withAnalysisId = (err: AppError, analysisId: string) =>
  new AppError(err.statusCode, err.message, err.code, { analysisId });

function toItemRows(
  analysisId: string,
  items: RecognisedItem[],
  references: Map<string, NutritionalReference>,
): NewRecognisedFoodItem[] {
  return estimateItems(items, references).map(
    ({ item, reference, portion, nutrients }, position) => ({
      analysisId,
      position,
      foodName: item.name,
      nutritionReferenceId: reference?.id ?? null,
      portionDescription: item.portionDescription,
      estimatedQuantity: portion?.quantity ?? null,
      quantityUnit: portion?.unit ?? null,
      recognitionConfidence: item.confidence,
      calories: nutrients?.calories ?? null,
      protein: nutrients?.protein ?? null,
      carbohydrates: nutrients?.carbohydrates ?? null,
      fat: nutrients?.fat ?? null,
    }),
  );
}

/** Analyses a meal photo and returns the id of the stored, completed analysis. */
export async function analyseMealPhoto(userId: string, photo: Buffer, context?: string) {
  // Both checks happen before anything is stored, so a bad photo or a missing API key
  // leaves no trace.
  const image = await prepareImage(photo);
  const provider = foodRecognitionProvider();

  const imageReference = await saveImage(userId, image.data);
  let analysisId: string;
  try {
    analysisId = analysesRepository.create({
      userId,
      imageReference,
      additionalContext: context ?? null,
    }).id;
  } catch (err) {
    await deleteImage(imageReference).catch(() => undefined);
    throw err;
  }

  const catalog = nutritionRepository.listCatalog();
  const started = performance.now();
  const elapsedMs = () => Math.round(performance.now() - started);

  let result: RecognitionResult;
  try {
    result = await provider.recognise({ image, context, nutritionCatalog: catalog });
  } catch (err) {
    const failure = err instanceof AppError ? err : null;
    analysesRepository.update(analysisId, {
      analysisStatus: 'failed',
      failureReason: failure?.code ?? 'INTERNAL_ERROR',
      processingTimeMs: elapsedMs(),
      analysedAt: new Date(),
    });
    throw failure ? withAnalysisId(failure, analysisId) : err;
  }

  const outcome = {
    aiResult: result.raw,
    aiProvider: result.provider,
    aiModel: result.model,
    aiInputTokens: result.usage.inputTokens,
    aiOutputTokens: result.usage.outputTokens,
    processingTimeMs: elapsedMs(),
    analysedAt: new Date(),
  };

  // Report §3.4.1 FR 21: tell the user when nothing recognisable was found.
  if (result.items.length === 0) {
    analysesRepository.update(analysisId, {
      ...outcome,
      analysisStatus: 'failed',
      failureReason: 'NO_FOOD_DETECTED',
    });
    throw withAnalysisId(
      new AppError(422, 'No food was found in this photo', 'NO_FOOD_DETECTED'),
      analysisId,
    );
  }

  const keys = result.items.flatMap((item) => (item.nutritionKey ? [item.nutritionKey] : []));
  const references = new Map(nutritionRepository.findByKeys(keys).map((ref) => [ref.key, ref]));

  db.transaction((tx) => {
    analysesRepository.createItems(toItemRows(analysisId, result.items, references), tx);
    analysesRepository.update(analysisId, { ...outcome, analysisStatus: 'completed' }, tx);
  });

  return analysisId;
}
