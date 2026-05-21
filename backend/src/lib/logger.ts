/**
 * logger.ts – Structured JSON logging with pino
 * Dependencies: pino
 *
 * Features:
 * - JSON format in production, pretty-print in development
 * - Sensitive data redaction (password, token, pem, secret, otp, code)
 * - Log level configurable via LOG_LEVEL env var
 */
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : isProduction ? 'info' : 'debug'),
  redact: {
    paths: [
      'password',
      'token',
      'pem',
      'secret',
      'otp',
      'code',
      'totpCode',
      'backupCodes',
      'tempToken',
      '*.accessToken',
      '*.refreshToken',
      '*.tempToken',
      'req.body.pem',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-client-cert"]',
    ],
    censor: '[REDACTED]',
  },
  transport: !isProduction && !isTest
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
});
