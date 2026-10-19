import { logger } from '../config/logger.js';
import { sqlite } from './index.js';
import { seedNutritionReferences } from './seeds/seed-nutrition.js';

const count = seedNutritionReferences();
logger.info({ count }, 'Nutritional references seeded');
sqlite.close();
