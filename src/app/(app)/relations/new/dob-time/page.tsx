'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { BirthDateField } from '@/components/picker/birth-date-field';
import { BirthTimeField } from '@/components/picker/birth-time-field';
import { useRelationDraft } from '@/lib/relations/draft-store';
import type { TimeAccuracy, Calendar } from '@/lib/relations/draft-store';

export default function RelationsDobTimePage() {
  const t = useTranslations('relations.new');
  const router = useRouter();
  const draft = useRelationDraft();

  const [birthDate, setBirthDate] = useState(draft.birthDate);
  const [calendar, setCalendar] = useState<Calendar>(draft.calendar);
  const [knowledge, setKnowledge] = useState<TimeAccuracy>(draft.knowledge);
  const [birthTime, setBirthTime] = useState(draft.birthTime);

  const canAdvance = !!birthDate && (knowledge === 'unknown' || !!birthTime);

  function handleNext() {
    draft.setBirthDate(birthDate);
    draft.setCalendar(calendar);
    draft.setKnowledge(knowledge);
    draft.setBirthTime(birthTime);
    router.push('/relations/new/mode');
  }

  return (
    <div className="px-4 space-y-5">
      <h1 className="font-h1 text-foreground whitespace-pre-line">{t('step2.headline')}</h1>
      <div className="rounded-[var(--r-md)] bg-card p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {(['solar', 'lunar'] as Calendar[]).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={calendar === v}
              onClick={() => setCalendar(v)}
              className={`py-2.5 rounded-[var(--r-pill)] text-[13px] font-semibold ${
                calendar === v ? 'bg-[var(--p-40)] text-white' : 'bg-[var(--surface-2)] text-foreground'
              }`}
            >
              {t(v === 'solar' ? 'birth.calendarSolar' : 'birth.calendarLunar')}
            </button>
          ))}
        </div>
        <BirthDateField label={t('birth.date')} value={birthDate} onChange={setBirthDate} />
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {(['exact', 'approximate', 'unknown'] as TimeAccuracy[]).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={knowledge === v}
              aria-label={t(`birth.timeAccuracy.${v === 'approximate' ? 'estimated' : v}`)}
              onClick={() => setKnowledge(v)}
              className={`py-2.5 rounded-[var(--r-sm)] text-[12px] font-semibold ${
                knowledge === v
                  ? 'bg-[var(--p-40)] text-white'
                  : 'bg-[var(--surface-1)] text-foreground border border-border'
              }`}
            >
              {t(`birth.timeAccuracy.${v === 'approximate' ? 'estimated' : v}`)}
            </button>
          ))}
        </div>
        {knowledge !== 'unknown' && (
          <BirthTimeField label={t('birth.timeOptional')} value={birthTime} onChange={setBirthTime} />
        )}
        {knowledge === 'unknown' && (
          <p className="text-[11px] text-muted-foreground">{t('birth.timeUnknownHint')}</p>
        )}
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
