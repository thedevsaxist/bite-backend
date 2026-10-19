import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { sqlite } from './db/index.js';
import { runMigrations } from './db/migrator.js';
import { scheduleStaleAnalysisCleanup } from './modules/analyses/stale-analyses.js';

// Bring the database schema up to date before accepting requests.
runMigrations();
// Analyses left half-done by a previous run (crash, restart during an AI call).
scheduleStaleAnalysisCleanup();

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    sqlite.close();
    process.exit(0);
  });
  // Force exit if open connections don't close in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});
