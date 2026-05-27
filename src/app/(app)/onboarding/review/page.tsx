'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  hasGuestLegalConsentReady,
  saveGuestOnboarding,
  saveGuestToday,
} from '@/lib/guest/session';
import { useOnboardingDraft } from '@/lib/onboarding/draft-store';
import type { ChartCore } from '@/types/chart';
import type { DailyHapCard } from '@/types/dailyHap';
import type { OnboardingRequest } from '@/types/onboarding';

export default function OnboardingReviewPage() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const draft = useOnboardingDraft();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { nickname, birthDate, calendar, knowledge, birthTime, gender } = draft;

  const summary: { label: string; value: string }[] = [
    { label: t('nickname.label'), value: nickname },
    { label: t('birth.date'), value: birthDate },
    { label: t('birth.calendar'), value: t(calendar === 'solar' ? 'birth.calendarSolar' : 'birth.calendarLunar') },
    { label: t('birth.timeOptional'), value: knowledge === 'unknown' ? t('birth.timeAccuracy.unknown') : birthTime },
    { label: t('gender.label'), value: gender === 'M' ? t('gender.male') : t('gender.female') },
  ];

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const body: OnboardingRequest = {
        nickname: nickname.trim(),
        birth_date: birthDate,
        birth_date_calendar: calendar,
        is_lunar_leap: false,
        birth_time_knowledge: knowledge,
        birth_time: knowledge === 'unknown' ? null : birthTime,
        gender: gender as 'M' | 'F',
      };
      if (hasGuestLegalConsentReady()) {
        saveGuestOnboarding(body);
        const res = await fetch('/api/guest/today', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) { setError(t('errors.generic')); setSubmitting(false); return; }
        const payload = (await res.json()) as {
          ok?: boolean;
          card?: DailyHapCard;
          chart?: ChartCore;
        };
        if (!payload.ok || !payload.card || !payload.chart) {
          setError(t('errors.generic'));
          setSubmitting(false);
          return;
        }
        saveGuestToday({
          onboarding: body,
          card: payload.card,
          chart: payload.chart,
          generatedAt: new Date().toISOString(),
        });
        draft.reset();
        router.push('/today/me');
        return;
      }

      const res = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError(t('errors.generic')); setSubmitting(false); return; }
      draft.reset();
      router.push('/');
    } catch {
      setError(t('errors.generic'));
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 space-y-5">
      <h1 className="font-h1 text-foreground whitespace-pre-line">{t('step4.headline')}</h1>
      <p className="font-sub text-muted-foreground">{t('step4.body')}</p>
      <div className="rounded-[var(--r-md)] bg-card p-4 space-y-2">
        {summary.map((s) => (
          <div key={s.label} className="flex items-center justify-between py-1.5">
            <span className="text-[12px] text-muted-foreground">{s.label}</span>
            <span className="font-semibold text-[14px] text-foreground">{s.value || '—'}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-[11px] text-muted-foreground">{t('privacy')}</p>
      {error && <p className="font-sub text-destructive text-center">{error}</p>}
      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto">
        <Button onClick={handleSubmit} disabled={submitting}
          variant="default" className="h-12 w-full rounded-[var(--r-pill)] font-bold">
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </div>
  );
}
