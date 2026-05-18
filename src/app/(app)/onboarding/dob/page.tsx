'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { BirthDateField } from '@/components/picker/birth-date-field';
import { useOnboardingDraft } from '@/lib/onboarding/draft-store';

export default function OnboardingDobPage() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const { nickname, setNickname, birthDate, setBirthDate } = useOnboardingDraft();
  const canAdvance = nickname.trim().length > 0 && !!birthDate;

  return (
    <div className="px-4 space-y-5">
      <h1 className="font-h1 text-foreground whitespace-pre-line">{t('step1.headline')}</h1>
      <p className="font-sub text-muted-foreground">{t('step1.body')}</p>
      <div className="rounded-[var(--r-md)] bg-card p-4 space-y-4">
        <div>
          <label htmlFor="nickname" className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
            {t('nickname.label')}
          </label>
          <input id="nickname" type="text" value={nickname} maxLength={20}
            placeholder={t('nickname.placeholder')}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full rounded-[var(--r-sm)] bg-surface-1 border border-border px-3.5 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <BirthDateField label={t('birth.date')} value={birthDate} onChange={setBirthDate} />
      </div>
      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto">
        <Button onClick={() => router.push('/onboarding/time')} disabled={!canAdvance}
          variant="default" className="h-12 w-full rounded-[var(--r-pill)] font-bold">
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
