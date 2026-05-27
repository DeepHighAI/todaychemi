'use client';

import type { LegalConsentState } from '@/lib/legal/consent';
import { signInWithOAuthProvider } from '@/lib/auth/oauth';

// Google OAuth 시작. 패턴: docs/patterns/supabase_callback.md.
// PII 5필드는 Auth 응답에서만 받고 LLM 페이로드 직렬화 금지(ADR-004).
export async function signInWithGoogle(
  legalConsent: LegalConsentState,
  options?: { next?: string; reuseExistingConsent?: boolean; deferLegalConsent?: boolean },
) {
  await signInWithOAuthProvider('google', legalConsent, options);
}
