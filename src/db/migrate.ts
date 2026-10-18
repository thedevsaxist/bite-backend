import { logger } from '../config/logger.js';
import { sqlite } from './index.js';
import { runMigrations } from './migrator.js';

runMigrations();
logger.info('Database migrations applied');
sqlite.close();
