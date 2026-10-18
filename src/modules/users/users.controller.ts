import type { Request, Response } from 'express';
import { authUser } from '../../middlewares/require-auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import { usersService } from './users.service.js';

export const usersController = {
  getMe(req: Request, res: Response) {
    sendSuccess(res, { user: usersService.getById(authUser(req).id) });
  },
};
