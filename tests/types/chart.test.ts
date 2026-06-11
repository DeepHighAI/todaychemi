import { describe, it, expect } from 'vitest';
import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';

describe('DEFAULT_THEORY_PROFILE_VERSION', () => {
  it('equals v3 (파생층 derived embedded — v2: ADR-021 진태양시 보정)', () => {
    expect(DEFAULT_THEORY_PROFILE_VERSION).toBe('v3');
  });

  it('is a string', () => {
    expect(typeof DEFAULT_THEORY_PROFILE_VERSION).toBe('string');
  });
});
