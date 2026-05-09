'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { TOS_VERSION } from '@/lib/onboarding/tos';
import type { OnboardingRequest } from '@/types/onboarding';

type TimeAccuracy = 'exact' | 'approximate' | 'unknown';
type Gender = 'M' | 'F' | '';
type Calendar = 'solar' | 'lunar';

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [calendar, setCalendar] = useState<Calendar>('solar');
  const [gender, setGender] = useState<Gender>('');
  const [knowledge, setKnowledge] = useState<TimeAccuracy>('exact');
  const [birthTime, setBirthTime] = useState('');
  const [tos, setTos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!nickname.trim()) { setError(t('errors.nicknameRequired')); return; }
    if (!birthDate) { setError(t('errors.dobRequired')); return; }
    if (knowledge !== 'unknown' && !birthTime) { setError(t('errors.timeRequiredWhenKnown')); return; }
    if (!gender) { setError(t('errors.genderRequired')); return; }
    if (!tos) { setError(t('tos.requiredError')); return; }

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
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(t('errors.generic'));
        setSubmitting(false);
        return;
      }
      router.push('/feed');
    } catch {
      setError(t('errors.generic'));
      setSubmitting(false);
    }
  }

  return (
    <main className="bg-background min-h-screen pb-32 px-4">
      <header className="pt-8 pb-6">
        {/* Progress bar 1/4 — UIDesign screens-entry.jsx::ScreenBirthDate Progress */}
        <div className="h-1 bg-[var(--surface-2)] rounded-full mb-4">
          <div className="h-full w-1/4 bg-[var(--p-40)] rounded-full" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-primary mb-2">
          {t('eyebrow')}
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground whitespace-pre-line">
          {t('headline')}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">{t('body')}</p>
      </header>

      {/* 섹션 1: 기본 정보 */}
      <section className="rounded-2xl bg-card p-4 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">{t('sections.basic')}</h2>

        {/* 별명 */}
        <div className="mb-4">
          <label htmlFor="nickname" className="block text-xs text-muted-foreground mb-1">
            {t('nickname.label')}
          </label>
          <input
            id="nickname"
            type="text"
            placeholder={t('nickname.placeholder')}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            className="w-full rounded-[var(--r-sm)] border border-border bg-[var(--surface-1)] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* 생년월일 */}
        <div className="mb-4">
          <label htmlFor="birth-date" className="block text-xs text-muted-foreground mb-1">
            {t('birth.date')}
          </label>
          <input
            id="birth-date"
            aria-label={t('birth.date')}
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full rounded-[var(--r-sm)] border border-border bg-[var(--surface-1)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* 양/음력 — UIDesign §1.6 Seg pill */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-1">{t('birth.calendar')}</p>
          <div className="flex gap-2" role="radiogroup">
            {([
              { value: 'solar', label: t('birth.calendarSolar') },
              { value: 'lunar', label: t('birth.calendarLunar') },
            ] as { value: Calendar; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={calendar === value}
                onClick={() => setCalendar(value)}
                className={`flex-1 rounded-[var(--r-pill)] px-4 py-2 text-sm font-semibold transition ${
                  calendar === value
                    ? 'bg-[var(--p-40)] text-white'
                    : 'bg-[var(--surface-2)] text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 성별 — UIDesign §1.6 Seg pill */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('gender.label')}</p>
          <div className="flex gap-2" role="radiogroup">
            {(['M', 'F'] as const).map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={gender === g}
                aria-label={g === 'M' ? t('gender.male') : t('gender.female')}
                onClick={() => setGender(g)}
                className={`flex-1 rounded-[var(--r-pill)] px-4 py-2 text-sm font-semibold transition ${
                  gender === g
                    ? 'bg-[var(--p-40)] text-white'
                    : 'bg-[var(--surface-2)] text-foreground'
                }`}
              >
                {g === 'M' ? t('gender.male') : t('gender.female')}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 섹션 2: 출생 시간 */}
      <section className="rounded-2xl bg-card p-4 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">{t('sections.time')}</h2>

        {/* 시간 정확도 3분기 */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-1">{t('birth.time')}</p>
          <div className="flex gap-3" role="radiogroup">
            {([
              { value: 'exact', label: t('birth.timeAccuracy.exact') },
              { value: 'approximate', label: t('birth.timeAccuracy.estimated') },
              { value: 'unknown', label: t('birth.timeAccuracy.unknown') },
            ] as { value: TimeAccuracy; label: string }[]).map(({ value, label }) => (
              <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="birth-time-knowledge"
                  value={value}
                  checked={knowledge === value}
                  onChange={() => setKnowledge(value)}
                  aria-label={label}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 시간 입력 (unknown 아닐 때만) */}
        {knowledge !== 'unknown' ? (
          <div>
            <label htmlFor="birth-time" className="block text-xs text-muted-foreground mb-1">
              {t('birth.timeOptional')}
            </label>
            <input
              id="birth-time"
              aria-label={t('birth.timeOptional')}
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              className="w-full rounded-[var(--r-sm)] border border-border bg-[var(--surface-1)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('birth.timeUnknownHint')}</p>
        )}
      </section>

      {/* ToS 동의 */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <input
          id="tos"
          type="checkbox"
          checked={tos}
          onChange={(e) => setTos(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <label htmlFor="tos" className="text-xs text-muted-foreground">
          {t('tos.label')}
        </label>
      </div>

      {/* 인라인 에러 */}
      {error && <p className="mb-4 text-center text-sm text-destructive">{error}</p>}

      {/* 개인정보 안내 */}
      <p className="text-center text-xs text-muted-foreground mb-6">{t('privacy')}</p>

      {/* 제출 버튼 (sticky) */}
      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!tos || submitting}
          variant="default"
          className="h-11 w-full"
        >
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </main>
  );
}
