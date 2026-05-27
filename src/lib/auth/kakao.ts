'use client';

import type { LegalConsentState } from '@/lib/legal/consent';
import { signInWithOAuthProvider } from '@/lib/auth/oauth';

// Kakao OAuth 시작. Supabase provider 설정은 docs/specs/auth.md 및 Kakao runbook 참조.
// Kakao profile/email은 로그인 식별에만 사용하고 LLM/공유 페이로드에는 직렬화하지 않는다.
export async function signInWithKakao(
  legalConsent: LegalConsentState,
  options?: { next?: string; reuseExistingConsent?: boolean; deferLegalConsent?: boolean },
) {
  await signInWithOAuthProvider('kakao', legalConsent, options);
}
