'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { TOS_VERSION } from '@/lib/onboarding/tos';
import { useOnboardingDraft } from '@/lib/onboarding/draft-store';
import type { OnboardingRequest } from '@/types/onboarding';

export default function OnboardingReviewPage() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const draft = useOnboardingDraft();
  const [tos, setTos] = useState(false);
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
        consented_tos_version: TOS_VERSION,
      };
      const res = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError(t('errors.generic')); setSubmitting(false); return; }
      draft.reset();
      router.push('/feed');
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
      <label className="flex items-center gap-2.5 px-1">
        <input type="checkbox" checked={tos} onChange={(e) => setTos(e.target.checked)}
          className="h-4 w-4 accent-primary" />
        <span className="text-[12px] text-muted-foreground">{t('tos.label')}</span>
      </label>
      <p className="text-center text-[11px] text-muted-foreground">{t('privacy')}</p>
      {error && <p className="font-sub text-destructive text-center">{error}</p>}
      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto">
        <Button onClick={handleSubmit} disabled={!tos || submitting}
          variant="default" className="h-12 w-full rounded-[var(--r-pill)] font-bold">
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </div>
  );
}
