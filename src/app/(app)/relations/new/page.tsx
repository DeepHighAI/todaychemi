'use client';

/* Relations New — 3-step flow
 * Canvas reference: type-d/screens-interactive.jsx::IRelName → IRelDob → IRelMode
 *
 * Before: 단일 페이지에 별명/모드/성별/생일/양력음력/시간정확도/시간/동의 모두
 * After:
 *   Step 1: 별명 + 동의
 *   Step 2: 생일 + 시 + 양/음력 + 성별
 *   Step 3: 6 모드 카드 그리드 (emoji + label + 한 줄 질문)
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { RelationCreate } from '@/types/relation';

type TimeAccuracy = 'exact' | 'approximate' | 'unknown';
type Gender = 'M' | 'F' | '';
type Calendar = 'solar' | 'lunar';
type Mode = '' | '일합' | '친구합' | '돈합' | '첫합' | '썸합' | '오래합';
type Step = 1 | 2 | 3;

const MODE_META: { value: Exclude<Mode, ''>; emoji: string }[] = [
  { value: '썸합', emoji: '💗' },
  { value: '오래합', emoji: '❤️' },
  { value: '일합', emoji: '💼' },
  { value: '친구합', emoji: '👋' },
  { value: '돈합', emoji: '💰' },
  { value: '첫합', emoji: '✨' },
];

export default function RelationsNewPage() {
  const t = useTranslations('relations.new');
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [nickname, setNickname] = useState('');
  const [consent, setConsent] = useState(false);

  const [birthDate, setBirthDate] = useState('');
  const [calendar, setCalendar] = useState<Calendar>('solar');
  const [gender, setGender] = useState<Gender>('');
  const [knowledge, setKnowledge] = useState<TimeAccuracy>('exact');
  const [birthTime, setBirthTime] = useState('');

  const [mode, setMode] = useState<Mode>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdvance = useMemo(() => {
    if (step === 1) return nickname.trim().length > 0 && consent;
    if (step === 2) return !!birthDate && !!gender && (knowledge === 'unknown' || !!birthTime);
    if (step === 3) return !!mode;
    return false;
  }, [step, nickname, consent, birthDate, gender, knowledge, birthTime, mode]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const body: RelationCreate = {
        nickname: nickname.trim(),
        mode: mode as RelationCreate['mode'],
        gender: gender as 'M' | 'F',
        birth_date: birthDate,
        birth_date_calendar: calendar,
        is_lunar_leap: false,
        birth_time_knowledge: knowledge,
        birth_time: knowledge === 'unknown' ? null : birthTime,
        birth_longitude: null,
        consent_confirmed: consent,
        is_primary: false,
      };
      const res = await fetch('/api/relations', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError(t('errors.generic')); setSubmitting(false); return; }
      const created = (await res.json().catch(() => null)) as { relation_id?: string } | null;
      router.push(created?.relation_id ? `/feed?focus=${created.relation_id}` : '/feed');
    } catch {
      setError(t('errors.generic'));
      setSubmitting(false);
    }
  }

  const next = () => {
    if (step < 3) setStep((s) => (s + 1) as Step);
    else handleSubmit();
  };
  const back = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
    else router.back();
  };

  return (
    <main className="bg-background min-h-screen pb-32">
      <header className="px-4 pt-3 pb-4 space-y-3">
        <button onClick={back} aria-label="back"
          className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-foreground active:opacity-60">
          <ChevronLeft size={22} />
        </button>
        <div className="h-1 bg-[var(--surface-2)] rounded-full">
          <div className="h-full bg-[var(--p-40)] rounded-full transition-[width] duration-300"
            style={{ width: `${(step / 3) * 100}%` }} />
        </div>
        <p className="font-eyebrow text-primary">{t('eyebrow')} · {step} / 3</p>
      </header>

      <div className="px-4 space-y-5">
        {step === 1 && (
          <>
            <h1 className="font-h1 text-foreground whitespace-pre-line">{t('step1.headline')}</h1>
            <p className="font-sub text-muted-foreground">{t('step1.body')}</p>
            <div className="rounded-[var(--r-md)] bg-card p-4 space-y-3">
              <label htmlFor="nickname" className="block text-[12px] font-semibold text-muted-foreground">
                {t('nickname.label')}
              </label>
              <input id="nickname" type="text" value={nickname} maxLength={20}
                placeholder={t('nickname.placeholder')}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full rounded-[var(--r-sm)] bg-[var(--surface-1)] border border-border px-3.5 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <label className="flex items-center gap-2.5 px-1">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                className="h-4 w-4 accent-primary" />
              <span className="text-[12px] text-muted-foreground">{t('consent.label')}</span>
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-h1 text-foreground whitespace-pre-line">{t('step2.headline')}</h1>
            <div className="rounded-[var(--r-md)] bg-card p-4 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">{t('birth.date')}</label>
                <input type="date" value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full rounded-[var(--r-sm)] bg-[var(--surface-1)] border border-border px-3.5 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {(['solar', 'lunar'] as Calendar[]).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={calendar === v}
                    onClick={() => setCalendar(v)}
                    className={`py-2.5 rounded-[var(--r-pill)] text-[13px] font-semibold ${
                      calendar === v ? 'bg-[var(--p-40)] text-white' : 'bg-[var(--surface-2)] text-foreground'
                    }`}>
                    {t(v === 'solar' ? 'birth.calendarSolar' : 'birth.calendarLunar')}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {(['M', 'F'] as const).map((g) => (
                  <button key={g} type="button" role="radio" aria-checked={gender === g}
                    onClick={() => setGender(g)}
                    className={`py-2.5 rounded-[var(--r-pill)] text-[13px] font-semibold ${
                      gender === g ? 'bg-[var(--p-40)] text-white' : 'bg-[var(--surface-2)] text-foreground'
                    }`}>
                    {t(g === 'M' ? 'gender.male' : 'gender.female')}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2" role="radiogroup">
                {(['exact', 'approximate', 'unknown'] as TimeAccuracy[]).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={knowledge === v}
                    onClick={() => setKnowledge(v)}
                    className={`py-2.5 rounded-[var(--r-sm)] text-[12px] font-semibold ${
                      knowledge === v ? 'bg-[var(--p-40)] text-white' : 'bg-[var(--surface-1)] text-foreground border border-border'
                    }`}>
                    {t(`birth.timeAccuracy.${v === 'approximate' ? 'estimated' : v}`)}
                  </button>
                ))}
              </div>
              {knowledge !== 'unknown' && (
                <input type="time" value={birthTime} aria-label={t('birth.timeOptional')}
                  onChange={(e) => setBirthTime(e.target.value)}
                  className="w-full rounded-[var(--r-sm)] bg-[var(--surface-1)] border border-border px-3.5 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="font-h1 text-foreground whitespace-pre-line">{t('step3.headline')}</h1>
            <p className="font-sub text-muted-foreground">{t('step3.body')}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {MODE_META.map(({ value, emoji }) => {
                const active = mode === value;
                return (
                  <button key={value} type="button"
                    onClick={() => setMode(value)}
                    className={`p-3.5 rounded-[var(--r-md)] text-left border transition flex flex-col gap-1.5 ${
                      active
                        ? 'border-[var(--p-40)] bg-[var(--p-90)]'
                        : 'border-border bg-card'
                    }`}>
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
          </>
        )}
      </div>

      {error && <p className="px-4 mt-4 font-sub text-destructive text-center">{error}</p>}

      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto">
        <Button onClick={next} disabled={!canAdvance || submitting}
          variant="default" className="h-12 w-full rounded-[var(--r-pill)] font-bold">
          {submitting ? t('submitting') : step === 3 ? t('submit') : t('next')}
        </Button>
      </div>
    </main>
  );
}
