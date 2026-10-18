import { pino } from 'pino';
import { env, isProduction, isTest } from './env.js';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.refreshToken'],
  // Pretty, human-readable logs in development; structured JSON in production.
  transport:
    isProduction || isTest ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});
