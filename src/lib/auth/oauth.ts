'use client';

import { recordLegalConsent } from '@/lib/legal/client-consent';
import type { LegalConsentProvider, LegalConsentState } from '@/lib/legal/consent';

export async function signInWithOAuthProvider(
  provider: LegalConsentProvider,
  legalConsent: LegalConsentState,
  options: { next?: string; reuseExistingConsent?: boolean; deferLegalConsent?: boolean } = {},
): Promise<void> {
  if (!options.reuseExistingConsent && !options.deferLegalConsent) {
    await recordLegalConsent(legalConsent, 'oauth', provider);
  }

  const oauthStartUrl = new URL('/auth/oauth', window.location.origin);
  oauthStartUrl.searchParams.set('provider', provider);
  const next = sanitizeNextPath(options.next);
  if (next) oauthStartUrl.searchParams.set('next', next);

  window.location.assign(oauthStartUrl.toString());
}

function sanitizeNextPath(next?: string): string | null {
  if (!next) return null;
  return next.startsWith('/') && !next.startsWith('//') ? next : null;
}
