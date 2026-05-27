import { describe, expect, it } from 'vitest';

import { generateShareToken, hashShareToken } from '@/lib/share/token';

describe('share token helpers', () => {
  it('generateShareToken returns non-empty URL-safe random token', () => {
    const token = generateShareToken();
    expect(token.length).toBeGreaterThan(30);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashShareToken is deterministic and does not equal raw token', () => {
    const token = 'share-token-001';
    expect(hashShareToken(token)).toBe(hashShareToken(token));
    expect(hashShareToken(token)).not.toBe(token);
  });
});
