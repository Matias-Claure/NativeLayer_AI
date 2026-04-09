import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const KEY_BYTES = 32;
const PREFIX_LENGTH = 8;

/**
 * Generates a new API key.
 * Returns `raw` (shown to user once), `hash` (stored in DB), `prefix` (for display).
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = randomBytes(KEY_BYTES).toString('base64url');
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, PREFIX_LENGTH);
  return { raw, hash, prefix };
}

/**
 * Hashes a raw API key using SHA-256.
 * Fast enough for per-request lookup; upgrade path: Argon2id.
 */
export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Constant-time comparison of a raw key against a stored hash.
 * Prevents timing-based enumeration of stored keys.
 */
export function verifyApiKey(raw: string, storedHash: string): boolean {
  const incoming = Buffer.from(hashApiKey(raw), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  if (incoming.length !== expected.length) return false;
  return timingSafeEqual(incoming, expected);
}
