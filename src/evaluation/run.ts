import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { env } from '../config/env.js';
import { sqlite } from '../db/index.js';
import { foodRecognitionProvider } from '../integrations/ai/index.js';
import { nutritionRepository } from '../modules/nutrition/nutrition.repository.js';
import { AppError } from '../utils/app-error.js';
import { runEvaluation } from './evaluate.js';
import { labelsFileSchema } from './labels.js';
import { formatReport } from './report.js';

// npm run evaluate -- [--dataset evaluation/dataset] [--out evaluation/results] [--limit 10]
// Each photo is one real AI call with the provider in .env, so a run costs money.

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values: args } = parseArgs({
  options: {
    dataset: { type: 'string', default: 'evaluation/dataset' },
    out: { type: 'string', default: 'evaluation/results' },
    limit: { type: 'string' },
  },
});

const labelsPath = path.join(args.dataset, 'labels.json');
if (!fs.existsSync(labelsPath)) {
  fail(
    `No ${labelsPath}. Copy evaluation/dataset/labels.example.json to it and describe your photos.`,
  );
}

const parsed = labelsFileSchema.safeParse(JSON.parse(fs.readFileSync(labelsPath, 'utf8')));
if (!parsed.success) fail(`${labelsPath} is invalid:\n${z.prettifyError(parsed.error)}`);
const limit = args.limit ? Number(args.limit) : undefined;
const labels = parsed.data.slice(0, limit);

const missing = labels.filter((label) => !fs.existsSync(path.join(args.dataset, label.image)));
if (missing.length > 0)
  fail(`Photos not found in ${args.dataset}:\n${missing.map((l) => `  ${l.image}`).join('\n')}`);

let provider;
try {
  provider = foodRecognitionProvider();
} catch (err) {
  fail(
    err instanceof AppError
      ? `${err.code}: set the API key for AI_PROVIDER=${env.AI_PROVIDER} in .env`
      : String(err),
  );
}

const catalog = nutritionRepository.listCatalog();
if (catalog.length === 0) fail('The nutrition table is empty. Run npm run db:seed first.');
const references = new Map(
  nutritionRepository.findByKeys(catalog.map((food) => food.key)).map((ref) => [ref.key, ref]),
);

console.log(
  `Evaluating ${labels.length} photos with ${env.AI_PROVIDER} (effort ${env.AI_EFFORT})…`,
);
const report = await runEvaluation({
  datasetDir: args.dataset,
  labels,
  provider,
  catalog,
  references,
  onProgress: (outcome, index, total) =>
    console.log(
      `[${index + 1}/${total}] ${outcome.image}: ${outcome.error ?? `${outcome.predictedFoods.join(', ')}, ${outcome.estimatedCalories} kcal`} (${outcome.durationMs} ms)`,
    ),
});

const generatedAt = new Date().toISOString();
const run = {
  generatedAt,
  provider: env.AI_PROVIDER,
  effort: env.AI_EFFORT,
  dataset: args.dataset,
};
const markdown = formatReport(report, run);

fs.mkdirSync(args.out, { recursive: true });
const base = path.join(args.out, `${generatedAt.replace(/[:.]/g, '-')}-${env.AI_PROVIDER}`);
fs.writeFileSync(`${base}.json`, JSON.stringify({ run, ...report }, null, 2));
fs.writeFileSync(`${base}.md`, markdown);

console.log(`\n${markdown}\nSaved ${base}.json and ${base}.md`);
sqlite.close();
