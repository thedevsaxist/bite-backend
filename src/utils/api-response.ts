import type { Response } from 'express';

/**
 * Every successful response has the shape `{ success: true, data }`, and every
 * error has the shape `{ success: false, error: { code, message, details? } }`,
 * so the Flutter client can parse all responses the same way.
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}
