import { normaliseLabel } from './labels.js';

// Evaluation metrics (report objective 4): recognition precision/recall/F1, calorie error
// against reference values, and response time.

/** What happened for one photo of the test set. */
export type ImageOutcome = {
  image: string;
  expectedFoods: string[];
  // Per recognised item: its catalog key, or its name when nothing in the catalog matched.
  predictedFoods: string[];
  referenceCalories: number | null;
  // Calories the app shows: calculated from the nutrition reference data.
  estimatedCalories: number | null;
  // The model's own estimate, made without the reference data.
  modelCalories: number | null;
  durationMs: number;
  // The model that answered (a fallback model if the requested one declined).
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  // Error code when the photo couldn't be analysed.
  error: string | null;
};

const round = (value: number, decimals = 3) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? null : round(numerator / denominator);

const uniqueLabels = (labels: string[]) => [...new Set(labels.map(normaliseLabel))];

/**
 * Matches predicted foods against the expected ones, as sets per photo. Failed photos count as
 * predicting nothing, so failures lower recall instead of being left out.
 */
export function recognitionMetrics(outcomes: ImageOutcome[]) {
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let exactMatches = 0;
  const perFood = new Map<string, { expected: number; found: number }>();
  const unexpected = new Map<string, number>();

  for (const outcome of outcomes) {
    const expected = uniqueLabels(outcome.expectedFoods);
    const predicted = new Set(uniqueLabels(outcome.predictedFoods));
    const found = expected.filter((food) => predicted.has(food));

    truePositives += found.length;
    falseNegatives += expected.length - found.length;
    const extra = [...predicted].filter((food) => !expected.includes(food));
    falsePositives += extra.length;
    if (found.length === expected.length && extra.length === 0) exactMatches += 1;

    for (const food of expected) {
      const stats = perFood.get(food) ?? { expected: 0, found: 0 };
      stats.expected += 1;
      if (predicted.has(food)) stats.found += 1;
      perFood.set(food, stats);
    }
    for (const food of extra) unexpected.set(food, (unexpected.get(food) ?? 0) + 1);
  }

  const precision = ratio(truePositives, truePositives + falsePositives);
  const recall = ratio(truePositives, truePositives + falseNegatives);
  const f1 =
    precision === null || recall === null || precision + recall === 0
      ? null
      : round((2 * precision * recall) / (precision + recall));

  return {
    images: outcomes.length,
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1,
    // Photos where exactly the right set of foods was found.
    exactMatchRate: ratio(exactMatches, outcomes.length),
    perFood: [...perFood]
      .map(([food, stats]) => ({ food, ...stats, recall: ratio(stats.found, stats.expected) }))
      .sort((a, b) => b.expected - a.expected || a.food.localeCompare(b.food)),
    // Foods the AI reported that weren't in the photo, most frequent first.
    falsePositiveFoods: [...unexpected]
      .map(([food, count]) => ({ food, count }))
      .sort((a, b) => b.count - a.count || a.food.localeCompare(b.food)),
  };
}

/** Error of calorie estimates against the reference values, over photos that have both. */
export function calorieMetrics(pairs: { estimate: number | null; reference: number | null }[]) {
  const usable = pairs.filter(
    (p): p is { estimate: number; reference: number } =>
      p.estimate !== null && p.reference !== null,
  );
  if (usable.length === 0) {
    return { count: 0, mae: null, mape: null, meanError: null, within20Percent: null };
  }
  const errors = usable.map((p) => p.estimate - p.reference);
  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
  const percentErrors = usable.map((p) => Math.abs(p.estimate - p.reference) / p.reference);

  return {
    count: usable.length,
    // Mean absolute error, in kcal.
    mae: round(mean(errors.map(Math.abs)), 1),
    // Mean absolute percentage error.
    mape: round(mean(percentErrors) * 100, 1),
    // Positive means estimates are too high on average, negative too low.
    meanError: round(mean(errors), 1),
    // Share of estimates within ±20% of the reference.
    within20Percent: round(percentErrors.filter((e) => e <= 0.2).length / usable.length),
  };
}

/** The value at percentile `p` (0–100), by the nearest-rank method. */
export function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return null;
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1]!;
}

export function timingMetrics(durationsMs: number[]) {
  const sorted = [...durationsMs].sort((a, b) => a - b);
  return {
    count: sorted.length,
    meanMs:
      sorted.length === 0 ? null : Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length),
    medianMs: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    maxMs: sorted.at(-1) ?? null,
  };
}
