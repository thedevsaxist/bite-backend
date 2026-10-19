import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runEvaluation } from '../src/evaluation/evaluate.js';
import { labelsFileSchema, type Label } from '../src/evaluation/labels.js';
import {
  calorieMetrics,
  percentile,
  recognitionMetrics,
  timingMetrics,
  type ImageOutcome,
} from '../src/evaluation/metrics.js';
import { formatReport } from '../src/evaluation/report.js';
import { nutritionRepository } from '../src/modules/nutrition/nutrition.repository.js';
import { AppError } from '../src/utils/app-error.js';
import { aiAnswer, item } from './fake-ai.js';
import { blurryJpeg, sharpJpeg } from './images.js';

const outcome = (overrides: Partial<ImageOutcome>): ImageOutcome => ({
  image: 'x.jpg',
  expectedFoods: [],
  predictedFoods: [],
  referenceCalories: null,
  estimatedCalories: null,
  modelCalories: null,
  durationMs: 1000,
  model: 'test-model',
  inputTokens: 100,
  outputTokens: 50,
  error: null,
  ...overrides,
});

describe('recognitionMetrics', () => {
  it('counts correct, missed and extra foods per photo', () => {
    const metrics = recognitionMetrics([
      // Both found.
      outcome({
        expectedFoods: ['jollof_rice', 'fried_plantain'],
        predictedFoods: ['fried_plantain', 'jollof_rice'],
      }),
      // One missed, one extra; duplicates and letter case don't matter.
      outcome({
        expectedFoods: ['eba', 'egusi_soup'],
        predictedFoods: ['EBA', 'eba', 'okra_soup'],
      }),
      // A failed photo predicts nothing.
      outcome({ expectedFoods: ['Zobo Drink'], error: 'AI_UNAVAILABLE' }),
    ]);

    expect(metrics).toMatchObject({
      images: 3,
      truePositives: 3,
      falseNegatives: 2,
      falsePositives: 1,
      precision: 0.75,
      recall: 0.6,
      f1: 0.667,
      exactMatchRate: 0.333,
      falsePositiveFoods: [{ food: 'okra_soup', count: 1 }],
    });
    expect(metrics.perFood.find((f) => f.food === 'egusi_soup')).toEqual({
      food: 'egusi_soup',
      expected: 1,
      found: 0,
      recall: 0,
    });
    expect(metrics.perFood.find((f) => f.food === 'zobo drink')).toMatchObject({ found: 0 });
  });

  it('has no precision or F1 when nothing was predicted', () => {
    expect(recognitionMetrics([outcome({ expectedFoods: ['eba'] })])).toMatchObject({
      precision: null,
      recall: 0,
      f1: null,
    });
  });
});

describe('calorieMetrics', () => {
  it('gives MAE, MAPE, bias and the share within ±20%, over photos with both values', () => {
    const metrics = calorieMetrics([
      { estimate: 900, reference: 1000 }, // −100, 10%
      { estimate: 600, reference: 400 }, // +200, 50%
      { estimate: 500, reference: null }, // no reference: left out
      { estimate: null, reference: 700 }, // failed: left out
    ]);

    expect(metrics).toEqual({ count: 2, mae: 150, mape: 30, meanError: 50, within20Percent: 0.5 });
  });

  it('is empty without comparable photos', () => {
    expect(calorieMetrics([{ estimate: 500, reference: null }])).toMatchObject({
      count: 0,
      mae: null,
    });
  });
});

describe('timing', () => {
  it('uses nearest-rank percentiles', () => {
    const durations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    expect(percentile(durations, 50)).toBe(500);
    expect(percentile(durations, 95)).toBe(1000);
    expect(timingMetrics([300, 100, 200])).toEqual({
      count: 3,
      meanMs: 200,
      medianMs: 200,
      p95Ms: 300,
      maxMs: 300,
    });
    expect(timingMetrics([])).toMatchObject({ count: 0, meanMs: null, medianMs: null });
  });
});

describe('labels file', () => {
  it('accepts the example file', () => {
    const example = JSON.parse(fs.readFileSync('evaluation/dataset/labels.example.json', 'utf8'));
    expect(labelsFileSchema.safeParse(example).success).toBe(true);
  });

  it('rejects entries without foods or with unknown fields', () => {
    expect(labelsFileSchema.safeParse([{ image: 'a.jpg', foods: [] }]).success).toBe(false);
    expect(
      labelsFileSchema.safeParse([{ image: 'a.jpg', foods: ['eba'], calories: 5 }]).success,
    ).toBe(false);
    expect(labelsFileSchema.safeParse([]).success).toBe(false);
  });
});

describe('runEvaluation', () => {
  it('runs each photo through the app’s steps and summarises the results', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-dataset-'));
    fs.writeFileSync(path.join(dir, 'jollof.jpg'), await sharpJpeg());
    fs.writeFileSync(path.join(dir, 'blurry.jpg'), await blurryJpeg());
    fs.writeFileSync(path.join(dir, 'down.jpg'), await sharpJpeg());
    const labels: Label[] = [
      {
        image: 'jollof.jpg',
        foods: ['jollof_rice', 'zobo drink'],
        referenceCalories: 550,
        context: 'Lunch',
      },
      { image: 'blurry.jpg', foods: ['eba'] },
      { image: 'down.jpg', foods: ['eba'], referenceCalories: 400 },
    ];

    const recognise = vi
      .fn()
      .mockResolvedValueOnce(
        aiAnswer([
          item({ name: 'jollof rice', nutritionKey: 'jollof_rice', estimatedGrams: 300 }),
          item({ name: 'zobo drink', estimatedGrams: 300 }),
        ]),
      )
      .mockRejectedValueOnce(new AppError(503, 'down', 'AI_UNAVAILABLE'));
    const catalog = nutritionRepository.listCatalog();
    const references = new Map(
      nutritionRepository.findByKeys(catalog.map((f) => f.key)).map((r) => [r.key, r]),
    );
    const progress = vi.fn();

    const report = await runEvaluation({
      datasetDir: dir,
      labels,
      provider: { name: 'fake', recognise },
      catalog,
      references,
      onProgress: progress,
    });

    // The blurry photo is rejected by the photo checks, before any AI call.
    expect(recognise).toHaveBeenCalledTimes(2);
    expect(recognise.mock.calls[0]![0].context).toBe('Lunch');
    expect(report.outcomes.map((o) => o.error)).toEqual([
      null,
      'IMAGE_TOO_BLURRY',
      'AI_UNAVAILABLE',
    ]);
    expect(report.outcomes[0]).toMatchObject({
      predictedFoods: ['jollof_rice', 'zobo drink'],
      // 300 g of jollof at 165 kcal / 100 g; the zobo has no reference values.
      estimatedCalories: 495,
      modelCalories: 950,
      model: 'claude-opus-5-5',
    });
    expect(report).toMatchObject({
      images: 3,
      models: ['claude-opus-5-5'],
      failures: { count: 2, byCode: { IMAGE_TOO_BLURRY: 1, AI_UNAVAILABLE: 1 } },
      recognition: { truePositives: 2, falseNegatives: 2, falsePositives: 0 },
      calories: { system: { count: 1, mae: 55, mape: 10 }, model: { count: 1, mae: 400 } },
      timing: { count: 1 },
      tokens: { meanInput: 2100, meanOutput: 450 },
    });
    expect(progress).toHaveBeenCalledTimes(3);

    const markdown = formatReport(report, {
      generatedAt: 'now',
      provider: 'fake',
      effort: 'medium',
      dataset: dir,
    });
    expect(markdown).toContain('| Recall | 50% |');
    expect(markdown).toContain('| Mean absolute error | 55 kcal | 400 kcal |');
    expect(markdown).toContain('IMAGE_TOO_BLURRY: 1');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
