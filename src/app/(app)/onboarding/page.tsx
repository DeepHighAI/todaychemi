'use client';

/* Onboarding — 4-step flow
 * Canvas reference: type-d/screens-interactive.jsx::IBirthDob → IBirthTime → IBirthCal → IBirthReview
 *
 * Before: 단일 페이지 long form, progress 1/4 fixed
 * After:
 *   Step 1: 별명 + 생년월일
 *   Step 2: 태어난 시 (또는 모름)
 *   Step 3: 양/음력 + 성별
 *   Step 4: ToS + 확인
 *   각 스텝마다 sticky CTA, progress 실제 1/4 → 4/4
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TOS_VERSION } from '@/lib/onboarding/tos';
import type { OnboardingRequest } from '@/types/onboarding';

type TimeAccuracy = 'exact' | 'approximate' | 'unknown';
type Gender = 'M' | 'F' | '';
type Calendar = 'solar' | 'lunar';

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [calendar, setCalendar] = useState<Calendar>('solar');
  const [gender, setGender] = useState<Gender>('');
  const [knowledge, setKnowledge] = useState<TimeAccuracy>('exact');
  const [birthTime, setBirthTime] = useState('');
  const [tos, setTos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdvance = useMemo(() => {
    if (step === 1) return nickname.trim().length > 0 && !!birthDate;
    if (step === 2) return knowledge === 'unknown' || !!birthTime;
    if (step === 3) return !!gender;
    if (step === 4) return tos;
    return false;
  }, [step, nickname, birthDate, knowledge, birthTime, gender, tos]);

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
      router.push('/feed');
    } catch {
      setError(t('errors.generic'));
      setSubmitting(false);
    }
  }

  const next = () => {
    if (step < 4) setStep((s) => (s + 1) as Step);
    else handleSubmit();
  };
  const back = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
    else router.back();
  };

  return (
    <main className="bg-background min-h-screen pb-32">
      {/* 상단 AppBar + Progress */}
      <header className="px-4 pt-3 pb-4 space-y-3">
        <button onClick={back} aria-label="back"
          className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-foreground active:opacity-60">
          <ChevronLeft size={22} />
        </button>
        <div className="h-1 bg-[var(--surface-2)] rounded-full">
          <div className="h-full bg-[var(--p-40)] rounded-full transition-[width] duration-300"
            style={{ width: `${(step / 4) * 100}%` }} />
        </div>
        <p className="font-eyebrow text-primary">{t('eyebrow')} · {step} / 4</p>
      </header>

      {/* 스텝별 헤드라인 + 입력 */}
      <div className="px-4 space-y-5">
        {step === 1 && (
          <Step1 nickname={nickname} setNickname={setNickname}
            birthDate={birthDate} setBirthDate={setBirthDate} t={t} />
        )}
        {step === 2 && (
          <Step2 knowledge={knowledge} setKnowledge={setKnowledge}
            birthTime={birthTime} setBirthTime={setBirthTime} t={t} />
        )}
        {step === 3 && (
          <Step3 calendar={calendar} setCalendar={setCalendar}
            gender={gender} setGender={setGender} t={t} />
        )}
        {step === 4 && (
          <Step4 t={t}
            nickname={nickname} birthDate={birthDate}
            calendar={calendar} knowledge={knowledge}
            birthTime={birthTime} gender={gender}
            tos={tos} setTos={setTos} />
        )}
      </div>

      {error && <p className="px-4 mt-4 font-sub text-destructive text-center">{error}</p>}

      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto">
        <Button onClick={next} disabled={!canAdvance || submitting}
          variant="default" className="h-12 w-full rounded-[var(--r-pill)] font-bold">
          {submitting ? t('submitting') : step === 4 ? t('submit') : t('next')}
        </Button>
      </div>
    </main>
  );
}

/* ─── Step 1 — 별명 + 생일 ─── */
function Step1({ nickname, setNickname, birthDate, setBirthDate, t }: {
  nickname: string; setNickname: (v: string) => void;
  birthDate: string; setBirthDate: (v: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
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
            className="w-full rounded-[var(--r-sm)] bg-[var(--surface-1)] border border-border px-3.5 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label htmlFor="birth-date" className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
            {t('birth.date')}
          </label>
          <input id="birth-date" type="date" value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full rounded-[var(--r-sm)] bg-[var(--surface-1)] border border-border px-3.5 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>
    </>
  );
}

/* ─── Step 2 — 태어난 시 ─── */
function Step2({ knowledge, setKnowledge, birthTime, setBirthTime, t }: {
  knowledge: TimeAccuracy; setKnowledge: (v: TimeAccuracy) => void;
  birthTime: string; setBirthTime: (v: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
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
                  : 'bg-[var(--surface-1)] text-foreground border border-border'
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
        {knowledge === 'unknown' && (
          <p className="text-[12px] text-muted-foreground">{t('birth.timeUnknownHint')}</p>
        )}
      </div>
    </>
  );
}

/* ─── Step 3 — 양/음력 + 성별 ─── */
function Step3({ calendar, setCalendar, gender, setGender, t }: {
  calendar: Calendar; setCalendar: (v: Calendar) => void;
  gender: Gender; setGender: (v: Gender) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      <h1 className="font-h1 text-foreground whitespace-pre-line">{t('step3.headline')}</h1>
      <div className="rounded-[var(--r-md)] bg-card p-4 space-y-4">
        <div>
          <p className="text-[12px] font-semibold text-muted-foreground mb-2">{t('birth.calendar')}</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(['solar', 'lunar'] as Calendar[]).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={calendar === v}
                onClick={() => setCalendar(v)}
                className={`py-3 rounded-[var(--r-pill)] text-[14px] font-semibold transition ${
                  calendar === v ? 'bg-[var(--p-40)] text-white' : 'bg-[var(--surface-2)] text-foreground'
                }`}>
                {t(v === 'solar' ? 'birth.calendarSolar' : 'birth.calendarLunar')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[12px] font-semibold text-muted-foreground mb-2">{t('gender.label')}</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(['M', 'F'] as const).map((g) => (
              <button key={g} type="button" role="radio" aria-checked={gender === g}
                onClick={() => setGender(g)}
                className={`py-3 rounded-[var(--r-pill)] text-[14px] font-semibold transition ${
                  gender === g ? 'bg-[var(--p-40)] text-white' : 'bg-[var(--surface-2)] text-foreground'
                }`}>
                {t(g === 'M' ? 'gender.male' : 'gender.female')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Step 4 — 확인 + ToS ─── */
function Step4({ t, nickname, birthDate, calendar, knowledge, birthTime, gender, tos, setTos }: {
  t: ReturnType<typeof useTranslations>;
  nickname: string; birthDate: string; calendar: Calendar;
  knowledge: TimeAccuracy; birthTime: string; gender: Gender;
  tos: boolean; setTos: (v: boolean) => void;
}) {
  const summary: { label: string; value: string }[] = [
    { label: t('nickname.label'), value: nickname },
    { label: t('birth.date'), value: birthDate },
    { label: t('birth.calendar'), value: t(calendar === 'solar' ? 'birth.calendarSolar' : 'birth.calendarLunar') },
    { label: t('birth.timeOptional'), value: knowledge === 'unknown' ? t('birth.timeAccuracy.unknown') : birthTime },
    { label: t('gender.label'), value: gender === 'M' ? t('gender.male') : t('gender.female') },
  ];
  return (
    <>
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
    </>
  );
}
