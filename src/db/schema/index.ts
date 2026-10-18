// Barrel file for all Drizzle table definitions.
// Each feature defines its tables in its own file here and re-exports them below,
// so both the app and drizzle-kit see the full schema.

export * from './users.js';
export * from './auth.js';
