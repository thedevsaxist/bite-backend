import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { isProduction } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

type HttpError = Error & { status?: number; statusCode?: number; expose?: boolean; type?: string };

// Express 5 forwards errors thrown in async handlers here automatically, so no try/catch is needed in controllers.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Errors raised by Express/body-parser (malformed JSON, payload too large, ...).
  const httpError = err as HttpError;
  const status = httpError.status ?? httpError.statusCode;
  if (status && status >= 400 && status < 500 && httpError.expose !== false) {
    res.status(status).json({
      success: false,
      error: {
        code: httpError.type === 'entity.parse.failed' ? 'INVALID_JSON' : 'BAD_REQUEST',
        message: httpError.message,
      },
    });
    return;
  }

  (req.log ?? logger).error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'Something went wrong' : httpError.message,
    },
  });
};
