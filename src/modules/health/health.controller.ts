import type { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { sendSuccess } from '../../utils/api-response.js';

export function getHealth(_req: Request, res: Response) {
  db.run(sql`select 1`);

  sendSuccess(res, {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
