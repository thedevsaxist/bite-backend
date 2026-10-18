import { beforeAll } from 'vitest';

// Runs before every test file. Values set here take precedence over .env.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = ':memory:';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars';

beforeAll(async () => {
  // Imported lazily so the env vars above are set before the database module loads.
  const { runMigrations } = await import('../src/db/migrator.js');
  runMigrations();
});
