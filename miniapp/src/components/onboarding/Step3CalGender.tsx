/**
 * Step3CalGender.tsx — Step 3: 달력 종류 + 성별
 *
 * 웹앱 원본: src/app/(app)/onboarding/cal-gender/page.tsx
 * 변경사항: next/navigation → props, Tailwind → 인라인 스타일.
 */

import { useTranslations } from 'next-intl';
import { useOnboardingDraft } from '@/lib/onboarding/draft-store';
import { Seg } from '@/components/ui/seg';

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
          <Seg
            options={[
              { value: 'solar', label: t('birth.calendarSolar') },
              { value: 'lunar', label: t('birth.calendarLunar') },
            ]}
            value={calendar}
            onChange={setCalendar}
            variant="fill"
            columns={2}
            ariaLabel={t('birth.calendar')}
          />
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
          <Seg
            options={[
              { value: 'M', label: t('gender.male') },
              { value: 'F', label: t('gender.female') },
            ]}
            value={gender}
            onChange={setGender}
            variant="fill"
            columns={2}
            ariaLabel={t('gender.label')}
          />
        </div>
      </div>
    </div>
  );
}
