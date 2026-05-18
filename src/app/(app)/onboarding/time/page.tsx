'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { BirthTimeField } from '@/components/picker/birth-time-field';
import { useOnboardingDraft, type TimeAccuracy } from '@/lib/onboarding/draft-store';

export default function OnboardingTimePage() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const { knowledge, setKnowledge, birthTime, setBirthTime } = useOnboardingDraft();
  const canAdvance = knowledge === 'unknown' || !!birthTime;

  return (
    <div className="px-4 space-y-5">
      <h1 className="font-h1 text-foreground whitespace-pre-line">{t('step2.headline')}</h1>
      <p className="font-sub text-muted-foreground">{t('step2.body')}</p>
      <div className="rounded-[var(--r-md)] bg-card p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {(['exact', 'approximate', 'unknown'] as TimeAccuracy[]).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={knowledge === v}
              onClick={() => setKnowledge(v)}
              className={`py-3 rounded-[var(--r-sm)] text-[12px] font-semibold transition ${
                knowledge === v
                  ? 'bg-[var(--p-40)] text-white'
                  : 'bg-surface-1 text-foreground border border-border'
              }`}>
              {t(`birth.timeAccuracy.${v === 'approximate' ? 'estimated' : v}`)}
            </button>
          ))}
        </div>
        {knowledge !== 'unknown' && (
          <BirthTimeField label={t('birth.timeOptional')} value={birthTime} onChange={setBirthTime} />
        )}
        {knowledge === 'unknown' && (
          <p className="text-[12px] text-muted-foreground">{t('birth.timeUnknownHint')}</p>
        )}
      </div>
      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto">
        <Button onClick={() => router.push('/onboarding/cal-gender')} disabled={!canAdvance}
          variant="default" className="h-12 w-full rounded-[var(--r-pill)] font-bold">
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
