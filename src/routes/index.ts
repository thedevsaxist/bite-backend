import { Router } from 'express';
import { analysesRouter } from '../modules/analyses/analyses.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { mealsRouter } from '../modules/meals/meals.routes.js';
import { nutritionRouter } from '../modules/nutrition/nutrition.routes.js';
import { profileRouter } from '../modules/profile/profile.routes.js';
import { settingsRouter } from '../modules/settings/settings.routes.js';
import { summaryRouter } from '../modules/summary/summary.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';

// Mounted at /api/v1. Register each feature module's router here.
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/nutrition', nutritionRouter);
apiRouter.use('/analyses', analysesRouter);
apiRouter.use('/meals', mealsRouter);
apiRouter.use('/summary', summaryRouter);
