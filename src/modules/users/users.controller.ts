import type { Request, Response } from 'express';
import { authUser } from '../../middlewares/require-auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import type { DeleteAccountInput } from './users.schemas.js';
import { usersService } from './users.service.js';

export const usersController = {
  getMe(req: Request, res: Response) {
    sendSuccess(res, { user: usersService.getById(authUser(req).id) });
  },

  async deleteMe(req: Request, res: Response) {
    const { password } = req.body as DeleteAccountInput;
    await usersService.deleteAccount(authUser(req).id, password);
    res.status(204).end();
  },
};
