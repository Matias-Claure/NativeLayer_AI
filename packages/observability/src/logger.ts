import pino, { type Logger, type LoggerOptions } from 'pino';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'secret',
  'api_key',
  'x-api-key',
  'authorization',
  'encrypted_shopify_token',
  'key_hash',
  'session',
  'cookie',
  'cvv',
  'card_number',
  'pan',
]);

/**
 * Recursively redacts sensitive fields from an object before logging.
 * Mutates a deep clone to avoid altering the original.
 */
export function redact(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[max_depth]';
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redact(value, depth + 1);
    }
  }
  return result;
}

function buildLoggerOptions(): LoggerOptions {
  const isDev = process.env['NODE_ENV'] !== 'production';
  return {
    level: process.env['LOG_LEVEL'] ?? (isDev ? 'debug' : 'info'),
    ...(isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : {}),
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["x-api-key"]',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
  };
}

export function createLogger(name?: string): Logger {
  const opts = buildLoggerOptions();
  return name ? pino(opts).child({ service: name }) : pino(opts);
}

export const logger = createLogger('nativelayer');
