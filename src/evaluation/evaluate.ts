import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { NutritionalReference } from '../db/schema/index.js';
import type { CatalogFood, FoodRecognitionProvider } from '../integrations/ai/index.js';
import { estimateItems } from '../modules/analyses/estimate-items.js';
import { prepareImage } from '../modules/analyses/image-processing.js';
import { sumNutrients } from '../modules/nutrition/calorie-calculator.js';
import { AppError } from '../utils/app-error.js';
import type { Label } from './labels.js';
import { calorieMetrics, recognitionMetrics, timingMetrics, type ImageOutcome } from './metrics.js';

type EvaluationOptions = {
  datasetDir: string;
  labels: Label[];
  provider: FoodRecognitionProvider;
  catalog: CatalogFood[];
  // Reference foods keyed by key, for the calorie calculation.
  references: Map<string, NutritionalReference>;
  onProgress?: (outcome: ImageOutcome, index: number, total: number) => void;
};

/**
 * Runs every labelled photo through the same steps as POST /analyses (photo checks, AI
 * recognition, nutrition matching and calorie calculation), without storing anything. The time
 * measured covers those steps, not the upload from the phone.
 */
async function evaluateImage(
  label: Label,
  { datasetDir, provider, catalog, references }: EvaluationOptions,
): Promise<ImageOutcome> {
  const base = {
    image: label.image,
    expectedFoods: label.foods,
    referenceCalories: label.referenceCalories ?? null,
  };
  const photo = await fs.readFile(path.join(datasetDir, label.image));
  const started = performance.now();

  try {
    const image = await prepareImage(photo);
    const result = await provider.recognise({
      image,
      context: label.context,
      nutritionCatalog: catalog,
    });
    const estimates = estimateItems(result.items, references);
    const durationMs = Math.round(performance.now() - started);

    return {
      ...base,
      predictedFoods: result.items.map((item) => item.nutritionKey ?? item.name),
      estimatedCalories:
        result.items.length === 0
          ? null
          : sumNutrients(estimates.flatMap((e) => (e.nutrients ? [e.nutrients] : []))).calories,
      modelCalories: result.modelCalorieEstimate,
      durationMs,
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      error: result.items.length === 0 ? 'NO_FOOD_DETECTED' : null,
    };
  } catch (err) {
    return {
      ...base,
      predictedFoods: [],
      estimatedCalories: null,
      modelCalories: null,
      durationMs: Math.round(performance.now() - started),
      model: null,
      inputTokens: null,
      outputTokens: null,
      error: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
    };
  }
}

export async function runEvaluation(options: EvaluationOptions) {
  const outcomes: ImageOutcome[] = [];
  // One photo at a time, so response times aren't skewed by parallel requests.
  for (const [index, label] of options.labels.entries()) {
    const outcome = await evaluateImage(label, options);
    outcomes.push(outcome);
    options.onProgress?.(outcome, index, options.labels.length);
  }

  const failures = outcomes.filter((o) => o.error !== null);
  const succeeded = outcomes.filter((o) => o.error === null);
  const mean = (values: (number | null)[]) => {
    const numbers = values.filter((v): v is number => v !== null);
    return numbers.length === 0
      ? null
      : Math.round(numbers.reduce((s, v) => s + v, 0) / numbers.length);
  };

  return {
    images: outcomes.length,
    models: [...new Set(succeeded.map((o) => o.model).filter((m): m is string => m !== null))],
    failures: {
      count: failures.length,
      byCode: Object.fromEntries(
        [...new Set(failures.map((f) => f.error!))].map((code) => [
          code,
          failures.filter((f) => f.error === code).length,
        ]),
      ),
    },
    recognition: recognitionMetrics(outcomes),
    calories: {
      // What the app shows: the reference data applied to the AI's foods and portions.
      system: calorieMetrics(
        outcomes.map((o) => ({ estimate: o.estimatedCalories, reference: o.referenceCalories })),
      ),
      // The model's own guess, for comparison.
      model: calorieMetrics(
        outcomes.map((o) => ({ estimate: o.modelCalories, reference: o.referenceCalories })),
      ),
    },
    timing: timingMetrics(succeeded.map((o) => o.durationMs)),
    tokens: {
      meanInput: mean(succeeded.map((o) => o.inputTokens)),
      meanOutput: mean(succeeded.map((o) => o.outputTokens)),
    },
    outcomes,
  };
}

export type EvaluationReport = Awaited<ReturnType<typeof runEvaluation>>;
