'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useOnboardingDraft, type Gender, type Calendar } from '@/lib/onboarding/draft-store';

export default function OnboardingCalGenderPage() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const { calendar, setCalendar, gender, setGender } = useOnboardingDraft();
  const canAdvance = !!gender;

  return (
    <div className="px-4 space-y-5">
      <h1 className="font-h1 text-foreground whitespace-pre-line">{t('step3.headline')}</h1>
      <div className="rounded-[var(--r-md)] bg-card p-4 space-y-4">
        <div>
          <p className="text-[12px] font-semibold text-muted-foreground mb-2">{t('birth.calendar')}</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(['solar', 'lunar'] as Calendar[]).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={calendar === v}
                onClick={() => setCalendar(v)}
                className={`py-3 rounded-[var(--r-pill)] text-[14px] font-semibold transition ${
                  calendar === v ? 'bg-[var(--p-40)] text-white' : 'bg-surface-2 text-foreground'
                }`}>
                {t(v === 'solar' ? 'birth.calendarSolar' : 'birth.calendarLunar')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[12px] font-semibold text-muted-foreground mb-2">{t('gender.label')}</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(['M', 'F'] as Gender[]).map((g) => (
              <button key={g} type="button" role="radio" aria-checked={gender === g}
                onClick={() => setGender(g)}
                className={`py-3 rounded-[var(--r-pill)] text-[14px] font-semibold transition ${
                  gender === g ? 'bg-[var(--p-40)] text-white' : 'bg-surface-2 text-foreground'
                }`}>
                {t(g === 'M' ? 'gender.male' : 'gender.female')}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto">
        <Button onClick={() => router.push('/onboarding/review')} disabled={!canAdvance}
          variant="default" className="h-12 w-full rounded-[var(--r-pill)] font-bold">
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
