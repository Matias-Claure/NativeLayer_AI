import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt } from '../encryption.js';

const key = randomBytes(32);

describe('encrypt / decrypt', () => {
  it('round-trips a plaintext string', () => {
    const plaintext = 'shpss_test_token_abc123';
    const encrypted = encrypt(plaintext, key);
    expect(encrypted.ciphertext).toBeTypeOf('string');
    expect(encrypted.iv).toBeTypeOf('string');
    expect(encrypted.tag).toBeTypeOf('string');

    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'same-token';
    const a = encrypt(plaintext, key);
    const b = encrypt(plaintext, key);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it('throws when the auth tag is tampered', () => {
    const plaintext = 'some-token';
    const encrypted = encrypt(plaintext, key);
    const tampered = { ...encrypted, tag: 'ff'.repeat(16) };
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it('throws when the ciphertext is tampered', () => {
    const plaintext = 'some-token';
    const encrypted = encrypt(plaintext, key);
    const tampered = {
      ...encrypted,
      ciphertext: 'aa'.repeat(encrypted.ciphertext.length / 2),
    };
    expect(() => decrypt(tampered, key)).toThrow();
  });
});
