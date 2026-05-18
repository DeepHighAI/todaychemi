'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useRelationDraft } from '@/lib/relations/draft-store';

type Gender = 'M' | 'F' | '';

export default function RelationsNamePage() {
  const t = useTranslations('relations.new');
  const router = useRouter();
  const draft = useRelationDraft();

  const [nickname, setNickname] = useState(draft.nickname);
  const [gender, setGender] = useState<Gender>(draft.gender);

  const canAdvance = nickname.trim().length > 0 && !!gender;

  function handleNext() {
    draft.setNickname(nickname.trim());
    draft.setGender(gender as 'M' | 'F');
    router.push('/relations/new/dob-time');
  }

  return (
    <div className="px-4 space-y-5">
      <h1 className="font-h1 text-foreground whitespace-pre-line">{t('step1.headline')}</h1>
      <p className="font-sub text-muted-foreground">{t('step1.body')}</p>
      <div className="rounded-[var(--r-md)] bg-card p-4 space-y-3">
        <label htmlFor="nickname" className="block text-[12px] font-semibold text-muted-foreground">
          {t('nickname.label')}
        </label>
        <input
          id="nickname"
          type="text"
          value={nickname}
          maxLength={20}
          placeholder={t('nickname.placeholder')}
          onChange={(e) => setNickname(e.target.value)}
          className="w-full rounded-[var(--r-sm)] bg-[var(--surface-1)] border border-border px-3.5 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="rounded-[var(--r-md)] bg-card p-4 space-y-2">
        <p className="text-[12px] font-semibold text-muted-foreground">{t('gender.label')}</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {(['M', 'F'] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={gender === g}
              onClick={() => setGender(g)}
              className={`py-2.5 rounded-[var(--r-pill)] text-[13px] font-semibold ${
                gender === g ? 'bg-[var(--p-40)] text-white' : 'bg-[var(--surface-2)] text-foreground'
              }`}
            >
              {t(g === 'M' ? 'gender.male' : 'gender.female')}
            </button>
          ))}
        </div>
      </div>
      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto">
        <Button
          onClick={handleNext}
          disabled={!canAdvance}
          variant="default"
          className="h-12 w-full rounded-[var(--r-pill)] font-bold"
        >
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
