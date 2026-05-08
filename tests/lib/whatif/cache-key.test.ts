import { describe, it, expect } from 'vitest';
import { deriveCacheKey } from '@/lib/whatif/cache-key';
import type { DiagnosticType } from '@/types/diagnostic';

const BASE = {
  chart_hash: 'a'.repeat(64),
  type: 'work' as DiagnosticType,
  prompt_version: 'v0.1',
};

describe('deriveCacheKey (whatif) — 결정성 + 민감도', () => {
  it('동일 input → 동일 hash', () => {
    expect(deriveCacheKey(BASE)).toBe(deriveCacheKey(BASE));
  });

  it('다른 type → 다른 hash', () => {
    const a = deriveCacheKey(BASE);
    const b = deriveCacheKey({ ...BASE, type: 'love' });
    expect(a).not.toBe(b);
  });

  it('다른 prompt_version → 다른 hash', () => {
    const a = deriveCacheKey(BASE);
    const b = deriveCacheKey({ ...BASE, prompt_version: 'v0.2' });
    expect(a).not.toBe(b);
  });
});
