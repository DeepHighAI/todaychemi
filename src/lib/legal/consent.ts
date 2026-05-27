export const LEGAL_VERSION = '2026-06-01';
export const LEGAL_TERMS_VERSION = LEGAL_VERSION;
export const LEGAL_PRIVACY_VERSION = LEGAL_VERSION;

export const LEGAL_CONSENT_FLOWS = ['email', 'oauth', 'guest'] as const;
export const LEGAL_CONSENT_PROVIDERS = ['google', 'kakao'] as const;

export interface LegalConsentState {
  terms: boolean;
  privacy: boolean;
  age: boolean;
}

export type LegalConsentFlow = (typeof LEGAL_CONSENT_FLOWS)[number];
export type LegalConsentProvider = (typeof LEGAL_CONSENT_PROVIDERS)[number];

export interface LegalConsentSnapshot {
  termsVersion: string;
  privacyVersion: string;
  ageConfirmed: true;
  consentedAt: string;
}

export const EMPTY_LEGAL_CONSENT: LegalConsentState = {
  terms: false,
  privacy: false,
  age: false,
};

export function isLegalConsentComplete(consent: LegalConsentState): boolean {
  return consent.terms && consent.privacy && consent.age;
}
