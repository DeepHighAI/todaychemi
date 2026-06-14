/**
 * Step3CalGender.tsx — Step 3: 달력 종류 + 성별
 *
 * 웹앱 원본: src/app/(app)/onboarding/cal-gender/page.tsx
 * 변경사항: next/navigation → props, Tailwind → 인라인 스타일.
 */

import { useTranslations } from 'next-intl';
import { useOnboardingDraft, type Calendar, type Gender } from '@/lib/onboarding/draft-store';

export function Step3CalGender() {
  const t = useTranslations('onboarding');
  const { calendar, setCalendar, gender, setGender } = useOnboardingDraft();

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1
        style={{
          font: 'var(--t-h1)',
          letterSpacing: 'var(--ls-tight)',
          color: 'var(--foreground)',
          margin: 0,
          whiteSpace: 'pre-line',
        }}
      >
        {t('step3.headline')}
      </h1>

      <div
        style={{
          borderRadius: 'var(--r-md)',
          backgroundColor: 'var(--card)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* 달력 종류 */}
        <div>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--muted-foreground)',
              margin: '0 0 8px',
            }}
          >
            {t('birth.calendar')}
          </p>
          <div
            role="radiogroup"
            aria-label={t('birth.calendar')}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
          >
            {(['solar', 'lunar'] as Calendar[]).map((v) => {
              const selected = calendar === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCalendar(v)}
                  style={{
                    padding: '12px 0',
                    borderRadius: 'var(--r-pill)',
                    fontSize: 14,
                    fontWeight: 600,
                    border: 'none',
                    backgroundColor: selected ? 'var(--p-40)' : 'var(--surface-2)',
                    color: selected ? '#ffffff' : 'var(--foreground)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s, color 0.15s',
                  }}
                >
                  {t(v === 'solar' ? 'birth.calendarSolar' : 'birth.calendarLunar')}
                </button>
              );
            })}
          </div>
        </div>

        {/* 성별 */}
        <div>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--muted-foreground)',
              margin: '0 0 8px',
            }}
          >
            {t('gender.label')}
          </p>
          <div
            role="radiogroup"
            aria-label={t('gender.label')}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
          >
            {(['M', 'F'] as Gender[]).map((g) => {
              const selected = gender === g;
              return (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setGender(g)}
                  style={{
                    padding: '12px 0',
                    borderRadius: 'var(--r-pill)',
                    fontSize: 14,
                    fontWeight: 600,
                    border: 'none',
                    backgroundColor: selected ? 'var(--p-40)' : 'var(--surface-2)',
                    color: selected ? '#ffffff' : 'var(--foreground)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s, color 0.15s',
                  }}
                >
                  {t(g === 'M' ? 'gender.male' : 'gender.female')}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
