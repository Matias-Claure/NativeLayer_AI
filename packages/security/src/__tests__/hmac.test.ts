import { describe, it, expect } from 'vitest';
import { signRequest, verifyHmac } from '../hmac.js';

describe('HMAC signing', () => {
  const secret = 'test-secret-12345';

  it('verifies a valid signature', () => {
    const payload = JSON.stringify({ query: 'shoes' });
    const sig = signRequest(payload, secret);
    expect(verifyHmac(payload, sig, secret)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const payload = JSON.stringify({ query: 'shoes' });
    const sig = signRequest(payload, secret);
    const tampered = JSON.stringify({ query: 'free stuff' });
    expect(verifyHmac(tampered, sig, secret)).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const payload = JSON.stringify({ query: 'shoes' });
    const sig = signRequest(payload, secret);
    const badSig = sig.replace(/a/g, 'b');
    expect(verifyHmac(payload, badSig, secret)).toBe(false);
  });

  it('rejects with a wrong secret', () => {
    const payload = JSON.stringify({ query: 'shoes' });
    const sig = signRequest(payload, secret);
    expect(verifyHmac(payload, sig, 'wrong-secret')).toBe(false);
  });
});
