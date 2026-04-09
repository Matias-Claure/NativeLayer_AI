import { randomBytes } from 'node:crypto';

/**
 * Generates a unique correlation ID for request tracing.
 * Format: "req_<16 random bytes as base64url>"
 */
export function generateCorrelationId(): string {
  return `req_${randomBytes(16).toString('base64url')}`;
}
