// 2026-06-15: 앱인토스 런칭 대응 개정 — 토스 로그인/IAP 반영, 폐지된 토큰 번들 충전 모델 삭제,
// 카카오 로그인 제거, 환불정책 pay-per-use 재작성. 내용 실질 변경이므로 버전 상향(기존 이용자 재동의 트리거).
export const LEGAL_VERSION = '2026-06-15';
export const LEGAL_TERMS_VERSION = LEGAL_VERSION;
export const LEGAL_PRIVACY_VERSION = LEGAL_VERSION;

// 'toss' = 앱인토스 미니앱 Toss 로그인 사용자(Bearer, 쿠키 불가). createClaimedLegalConsentRecord 로 직접 기록.
export const LEGAL_CONSENT_FLOWS = ['email', 'oauth', 'guest', 'toss'] as const;
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
