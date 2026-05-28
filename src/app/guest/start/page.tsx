'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { LegalConsentBlock } from '@/components/legal/legal-consent-block';
import { Button } from '@/components/ui/button';
import {
  EMPTY_LEGAL_CONSENT,
  isLegalConsentComplete,
  type LegalConsentState,
} from '@/lib/legal/consent';
import { recordLegalConsent } from '@/lib/legal/client-consent';
import { markGuestLegalConsentReady } from '@/lib/guest/session';

export default function GuestStartPage() {
  const router = useRouter();
  const [consent, setConsent] = useState<LegalConsentState>(EMPTY_LEGAL_CONSENT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = isLegalConsentComplete(consent);

  async function handleStart() {
    try {
      setLoading(true);
      setError(null);
      await recordLegalConsent(consent, 'guest');
      markGuestLegalConsentReady();
      router.push('/onboarding/dob');
    } catch {
      setLoading(false);
      setError('동의 처리에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center gap-6">
        <div className="space-y-3">
          <p className="font-eyebrow text-primary">처음이세요?</p>
          <h1 className="text-3xl font-black leading-tight text-foreground">
            누군가와의 오늘을
            <br />
            미리 보려면 동의가 필요해요.
          </h1>
          <p className="font-sub text-muted-foreground">
            생년월일과 출생시간은 사주 계산에만 사용하고, 가입 전 입력값은 현재 탭에만 저장합니다.
          </p>
        </div>

        <LegalConsentBlock
          value={consent}
          onChange={setConsent}
          disabled={loading}
          title="게스트 체험 필수 동의"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="button"
          onClick={handleStart}
          disabled={!complete || loading}
          className="h-12 w-full rounded-[var(--r-pill)] font-bold"
        >
          {loading ? '준비 중...' : '동의하고 시작하기'}
        </Button>
      </section>
    </main>
  );
}
