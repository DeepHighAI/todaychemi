'use client';

import {
  isLegalConsentComplete,
  type LegalConsentFlow,
  type LegalConsentProvider,
  type LegalConsentState,
} from '@/lib/legal/consent';

export async function recordLegalConsent(
  consent: LegalConsentState,
  flow: LegalConsentFlow,
  provider?: LegalConsentProvider,
): Promise<void> {
  if (!isLegalConsentComplete(consent)) {
    throw new Error('LEGAL_CONSENT_REQUIRED');
  }

  const res = await fetch('/api/legal/consent', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...consent, flow, provider }),
  });

  if (!res.ok) {
    throw new Error('LEGAL_CONSENT_REQUIRED');
  }
}

export async function recordSocialLegalConsent(
  consent: LegalConsentState,
  provider: LegalConsentProvider,
): Promise<{ alreadyOnboarded: boolean }> {
  if (!isLegalConsentComplete(consent)) {
    throw new Error('LEGAL_CONSENT_REQUIRED');
  }

  const res = await fetch('/api/legal/social-consent', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...consent, provider }),
  });

  if (!res.ok) {
    throw new Error('LEGAL_CONSENT_REQUIRED');
  }

  const data = (await res.json().catch(() => ({}))) as { already_onboarded?: boolean };
  return { alreadyOnboarded: data.already_onboarded === true };
}
