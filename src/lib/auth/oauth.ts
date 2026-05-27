'use client';

import { recordLegalConsent } from '@/lib/legal/client-consent';
import type { LegalConsentProvider, LegalConsentState } from '@/lib/legal/consent';
import { createClient } from '@/lib/supabase/client';

export async function signInWithOAuthProvider(
  provider: LegalConsentProvider,
  legalConsent: LegalConsentState,
  options: { next?: string; reuseExistingConsent?: boolean; deferLegalConsent?: boolean } = {},
): Promise<void> {
  if (!options.reuseExistingConsent && !options.deferLegalConsent) {
    await recordLegalConsent(legalConsent, 'oauth', provider);
  }

  const supabase = createClient();
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  callbackUrl.searchParams.set('provider', provider);
  const next = sanitizeNextPath(options.next);
  if (next) callbackUrl.searchParams.set('next', next);
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });
  if (error) throw error;
}

function sanitizeNextPath(next?: string): string | null {
  if (!next) return null;
  return next.startsWith('/') && !next.startsWith('//') ? next : null;
}
