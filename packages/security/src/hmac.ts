import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Creates an HMAC-SHA256 signature for a payload.
 * Used by AI clients to sign requests (optional — controlled by REQUIRE_HMAC_SIGNING).
 */
export function signRequest(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verifies a request signature in constant time.
 * @param payload   Raw request body string.
 * @param signature Hex signature from X-Signature header.
 * @param secret    Shared secret for the client.
 */
export function verifyHmac(payload: string, signature: string, secret: string): boolean {
  const expected = signRequest(payload, secret);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
