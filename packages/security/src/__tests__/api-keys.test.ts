import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, verifyApiKey } from '../api-keys.js';

describe('generateApiKey', () => {
  it('returns a raw key, hash, and prefix', () => {
    const { raw, hash, prefix } = generateApiKey();
    expect(raw).toBeTypeOf('string');
    expect(raw.length).toBeGreaterThan(20);
    expect(hash).toBeTypeOf('string');
    expect(hash.length).toBe(64); // SHA-256 hex
    expect(raw.startsWith(prefix)).toBe(true);
    expect(prefix.length).toBe(8);
  });

  it('produces unique keys each call', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('verifyApiKey', () => {
  it('returns true for a matching raw key and hash', () => {
    const { raw, hash } = generateApiKey();
    expect(verifyApiKey(raw, hash)).toBe(true);
  });

  it('returns false for a wrong key', () => {
    const { hash } = generateApiKey();
    const { raw: otherRaw } = generateApiKey();
    expect(verifyApiKey(otherRaw, hash)).toBe(false);
  });

  it('returns false for a tampered hash', () => {
    const { raw } = generateApiKey();
    expect(verifyApiKey(raw, 'a'.repeat(64))).toBe(false);
  });
});
