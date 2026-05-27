'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { LegalConsentBlock } from '@/components/legal/legal-consent-block';
import { Button } from '@/components/ui/button';
import { recordSocialLegalConsent } from '@/lib/legal/client-consent';
import {
  EMPTY_LEGAL_CONSENT,
  isLegalConsentComplete,
  type LegalConsentProvider,
  type LegalConsentState,
} from '@/lib/legal/consent';

interface SocialConsentClientProps {
  provider: LegalConsentProvider;
  next: string;
}

export function SocialConsentClient({ provider, next }: SocialConsentClientProps) {
  const t = useTranslations('auth.socialConsent');
  const router = useRouter();
  const [consent, setConsent] = useState<LegalConsentState>(EMPTY_LEGAL_CONSENT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = isLegalConsentComplete(consent);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      setLoading(true);
      setError(null);
      const result = await recordSocialLegalConsent(consent, provider);
      router.replace(result.alreadyOnboarded ? '/' : next);
    } catch {
      setError(t('errorGeneric'));
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-[var(--r-xl)] bg-card p-8 shadow">
        <p className="font-eyebrow mb-2 text-center text-primary">
          {provider === 'google' ? 'Google' : 'Kakao'}
        </p>
        <h1 className="mb-2 text-center text-xl font-semibold text-foreground">
          {t('title')}
        </h1>
        <p className="mb-5 text-center text-sm leading-6 text-muted-foreground">
          {t('body')}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <LegalConsentBlock
            value={consent}
            onChange={setConsent}
            disabled={loading}
            title={t('legalTitle')}
          />

          <Button
            type="submit"
            disabled={loading || !canSubmit}
            variant="default"
            className="h-11 w-full"
          >
            {loading ? t('loading') : t('submitButton')}
          </Button>
        </form>

        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
