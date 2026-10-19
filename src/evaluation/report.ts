import type { EvaluationReport } from './evaluate.js';

// A readable summary of an evaluation run, for the project report (chapter 4).

export type RunInfo = { generatedAt: string; provider: string; effort: string; dataset: string };

const value = (v: number | null, suffix = '') => (v === null ? '–' : `${v}${suffix}`);
const percent = (v: number | null) => (v === null ? '–' : `${Math.round(v * 1000) / 10}%`);

export function formatReport(report: EvaluationReport, run: RunInfo) {
  const { recognition, calories, timing, tokens, failures } = report;
  const lines = [
    `# Evaluation: ${run.provider} (${report.models.join(', ') || 'no successful answers'})`,
    '',
    `- Run: ${run.generatedAt}`,
    `- Dataset: ${run.dataset}, ${report.images} photos`,
    `- Effort: ${run.effort}`,
    `- Failed photos: ${failures.count}${
      failures.count
        ? ` (${Object.entries(failures.byCode)
            .map(([code, n]) => `${code}: ${n}`)
            .join(', ')})`
        : ''
    }`,
    '',
    '## Food recognition',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| Precision | ${percent(recognition.precision)} |`,
    `| Recall | ${percent(recognition.recall)} |`,
    `| F1 score | ${percent(recognition.f1)} |`,
    `| Photos with exactly the right foods | ${percent(recognition.exactMatchRate)} |`,
    `| Correct / missed / extra foods | ${recognition.truePositives} / ${recognition.falseNegatives} / ${recognition.falsePositives} |`,
    '',
    '### Per food',
    '',
    '| Food | In photos | Found | Recall |',
    '| --- | --- | --- | --- |',
    ...recognition.perFood.map(
      (f) => `| ${f.food} | ${f.expected} | ${f.found} | ${percent(f.recall)} |`,
    ),
    '',
  ];

  if (recognition.falsePositiveFoods.length > 0) {
    lines.push(
      '### Foods reported but not in the photo',
      '',
      '| Food | Times |',
      '| --- | --- |',
      ...recognition.falsePositiveFoods.map((f) => `| ${f.food} | ${f.count} |`),
      '',
    );
  }

  lines.push(
    '## Calorie estimation',
    '',
    'Compared with each photo’s reference calories. "System" is what the app shows (reference data',
    'applied to the recognised foods and portions); "model" is the AI’s own estimate.',
    '',
    '| Metric | System | Model |',
    '| --- | --- | --- |',
    `| Photos compared | ${calories.system.count} | ${calories.model.count} |`,
    `| Mean absolute error | ${value(calories.system.mae, ' kcal')} | ${value(calories.model.mae, ' kcal')} |`,
    `| Mean absolute percentage error | ${value(calories.system.mape, '%')} | ${value(calories.model.mape, '%')} |`,
    `| Mean error (bias) | ${value(calories.system.meanError, ' kcal')} | ${value(calories.model.meanError, ' kcal')} |`,
    `| Within ±20% | ${percent(calories.system.within20Percent)} | ${percent(calories.model.within20Percent)} |`,
    '',
    '## Response time',
    '',
    'Photo checks, AI recognition and calorie calculation, per photo (successful photos only).',
    '',
    '| Mean | Median | 95th percentile | Max |',
    '| --- | --- | --- | --- |',
    `| ${value(timing.meanMs, ' ms')} | ${value(timing.medianMs, ' ms')} | ${value(timing.p95Ms, ' ms')} | ${value(timing.maxMs, ' ms')} |`,
    '',
    `Mean tokens per photo: ${value(tokens.meanInput)} in, ${value(tokens.meanOutput)} out.`,
    '',
  );
  return lines.join('\n');
}
