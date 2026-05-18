'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useRelationDraft } from '@/lib/relations/draft-store';
import type { DraftMode } from '@/lib/relations/draft-store';
import type { RelationCreate } from '@/types/relation';

const MODE_META: { value: Exclude<DraftMode, ''>; emoji: string }[] = [
  { value: '썸합', emoji: '💗' },
  { value: '오래합', emoji: '❤️' },
  { value: '일합', emoji: '💼' },
  { value: '친구합', emoji: '👋' },
  { value: '돈합', emoji: '💰' },
  { value: '첫합', emoji: '✨' },
];

export default function RelationsModePage() {
  const t = useTranslations('relations.new');
  const router = useRouter();
  const draft = useRelationDraft();

  const [mode, setMode] = useState<DraftMode>(draft.mode);
  const [consent, setConsent] = useState(draft.consent);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!mode && consent;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const body: RelationCreate = {
        nickname: draft.nickname.trim(),
        mode: mode as RelationCreate['mode'],
        gender: draft.gender as 'M' | 'F',
        birth_date: draft.birthDate,
        birth_date_calendar: draft.calendar,
        is_lunar_leap: false,
        birth_time_knowledge: draft.knowledge,
        birth_time: draft.knowledge === 'unknown' ? null : draft.birthTime,
        birth_longitude: null,
        consent_confirmed: consent,
        is_primary: false,
      };
      const res = await fetch('/api/relations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(t('errors.generic'));
        setSubmitting(false);
        return;
      }
      const created = (await res.json().catch(() => null)) as { relation_id?: string } | null;
      draft.reset();
      router.push(created?.relation_id ? `/feed?focus=${created.relation_id}` : '/feed');
    } catch {
      setError(t('errors.generic'));
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 space-y-5">
      <h1 className="font-h1 text-foreground whitespace-pre-line">{t('step3.headline')}</h1>
      <p className="font-sub text-muted-foreground">{t('step3.body')}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {MODE_META.map(({ value, emoji }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`p-3.5 rounded-[var(--r-md)] text-left border transition flex flex-col gap-1.5 ${
                active ? 'border-[var(--p-40)] bg-[var(--p-90)]' : 'border-border bg-card'
              }`}
            >
              <span className="text-[22px] leading-none">{emoji}</span>
              <span className={`font-bold text-[14px] ${active ? 'text-[var(--p-10)]' : 'text-foreground'}`}>
                {t(`mode.${value}`)}
              </span>
              <span className={`text-[11px] ${active ? 'text-[var(--p-30)]' : 'text-muted-foreground'}`}>
                {t(`modeQuestion.${value}`)}
              </span>
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2.5 px-1">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <span className="text-[12px] text-muted-foreground">{t('consent.label')}</span>
      </label>
      {error && <p className="font-sub text-destructive text-center">{error}</p>}
      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          variant="default"
          className="h-12 w-full rounded-[var(--r-pill)] font-bold"
        >
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </div>
  );
}
