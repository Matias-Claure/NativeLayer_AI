import { describe, it, expect } from 'vitest';
import { redact } from '../logger.js';

describe('redact', () => {
  it('redacts known sensitive keys', () => {
    const input = {
      user: 'alice',
      password: 'secret123',
      token: 'tok_abc',
      api_key: 'key_xyz',
    };
    const result = redact(input) as Record<string, unknown>;
    expect(result['user']).toBe('alice');
    expect(result['password']).toBe('[REDACTED]');
    expect(result['token']).toBe('[REDACTED]');
    expect(result['api_key']).toBe('[REDACTED]');
  });

  it('redacts nested sensitive keys', () => {
    const input = {
      request: {
        headers: {
          authorization: 'Bearer abc',
          'content-type': 'application/json',
        },
        body: { query: 'shoes' },
      },
    };
    const result = redact(input) as { request: { headers: Record<string, unknown> } };
    expect(result.request.headers['authorization']).toBe('[REDACTED]');
    expect(result.request.headers['content-type']).toBe('application/json');
  });

  it('handles arrays without throwing', () => {
    const input = [{ token: 'abc' }, { name: 'safe' }];
    const result = redact(input) as Array<Record<string, unknown>>;
    expect(result[0]?.['token']).toBe('[REDACTED]');
    expect(result[1]?.['name']).toBe('safe');
  });

  it('handles null and primitives', () => {
    expect(redact(null)).toBeNull();
    expect(redact('string')).toBe('string');
    expect(redact(42)).toBe(42);
  });
});
