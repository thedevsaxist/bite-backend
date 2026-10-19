import { logger } from '../../config/logger.js';
import { analysesRepository } from './analyses.repository.js';

// An analysis is "processing" only while its AI call runs (at most a few minutes, with retries).
// If the server stops mid-call, the analysis would stay "processing" for ever, so analyses older
// than this are marked failed with reason INTERRUPTED.
const STALE_AFTER_MS = 10 * 60 * 1000;

export function failInterruptedAnalyses(now = new Date()) {
  const count = analysesRepository.failStale(new Date(now.getTime() - STALE_AFTER_MS));
  if (count > 0) logger.warn({ count }, 'Marked interrupted analyses as failed');
  return count;
}

/** Runs the cleanup now and then every 10 minutes, without keeping the process alive. */
export function scheduleStaleAnalysisCleanup() {
  failInterruptedAnalyses();
  setInterval(() => failInterruptedAnalyses(), STALE_AFTER_MS).unref();
}
