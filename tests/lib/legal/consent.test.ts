import { describe, expect, it } from 'vitest';

import {
  EMPTY_LEGAL_CONSENT,
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
  isLegalConsentComplete,
} from '@/lib/legal/consent';

describe('legal consent helpers', () => {
  it('keeps separated terms/privacy versions aligned to legal effective date', () => {
    expect(LEGAL_TERMS_VERSION).toBe('2026-06-01');
    expect(LEGAL_PRIVACY_VERSION).toBe('2026-06-01');
  });

  it('starts with all required consent items unchecked', () => {
    expect(EMPTY_LEGAL_CONSENT).toEqual({ terms: false, privacy: false, age: false });
    expect(isLegalConsentComplete(EMPTY_LEGAL_CONSENT)).toBe(false);
  });

  it('requires terms, privacy, and age confirmation together', () => {
    expect(isLegalConsentComplete({ terms: true, privacy: true, age: true })).toBe(true);
    expect(isLegalConsentComplete({ terms: true, privacy: false, age: true })).toBe(false);
    expect(isLegalConsentComplete({ terms: true, privacy: true, age: false })).toBe(false);
  });
});
