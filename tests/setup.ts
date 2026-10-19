import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll } from 'vitest';

// Runs before every test file. Values set here take precedence over .env.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = ':memory:';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars';
// Tests store photos on disk, in a throwaway folder per test file, even if .env selects Supabase.
process.env.STORAGE_DRIVER = 'local';
// Tests never call the real Claude API, even if .env has a key.
process.env.ANTHROPIC_API_KEY = '';
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calorie-api-uploads-'));
process.env.UPLOAD_DIR = uploadDir;

beforeAll(async () => {
  // Imported lazily so the env vars above are set before the database module loads.
  const { runMigrations } = await import('../src/db/migrator.js');
  const { seedNutritionReferences } = await import('../src/db/seeds/seed-nutrition.js');
  runMigrations();
  seedNutritionReferences();
});

afterAll(() => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
});
