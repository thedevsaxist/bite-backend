import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { usersController } from './users.controller.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, usersController.getMe);
