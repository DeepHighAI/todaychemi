/**
 * Step1NicknameDob.tsx — Step 1: 별명 + 생년월일
 *
 * 웹앱 원본: src/app/(app)/onboarding/dob/page.tsx
 * 변경사항:
 *   - 생년월일 = iOS 휠 피커(DateWheelField). 출력은 동일한 YYYY-MM-DD.
 *   - next-intl useTranslations 유지
 */

import { useTranslations } from 'next-intl';
import { useOnboardingDraft } from '@/lib/onboarding/draft-store';
import { DateWheelField } from '@/components/ui/date-wheel-field';

const CURRENT_YEAR = new Date().getFullYear();
const MAX_DATE = `${CURRENT_YEAR}-12-31`;
const MIN_DATE = '1900-01-01';

export function Step1NicknameDob() {
  const t = useTranslations('onboarding');
  const { nickname, setNickname, birthDate, setBirthDate } = useOnboardingDraft();

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1
          style={{
            font: 'var(--t-h1)',
            letterSpacing: 'var(--ls-tight)',
            color: 'var(--foreground)',
            margin: 0,
            whiteSpace: 'pre-line',
          }}
        >
          {t('step1.headline')}
        </h1>
        <p
          style={{
            font: 'var(--t-sub)',
            color: 'var(--muted-foreground)',
            margin: '8px 0 0',
          }}
        >
          {t('step1.body')}
        </p>
      </div>

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
        {/* 별명 입력 */}
        <div>
          <label
            htmlFor="nickname"
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--muted-foreground)',
              marginBottom: 6,
            }}
          >
            {t('nickname.label')}
          </label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            maxLength={20}
            placeholder={t('nickname.placeholder')}
            onChange={(e) => setNickname(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              borderRadius: 'var(--r-sm)',
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border)',
              padding: '12px 14px',
              fontSize: 15,
              color: 'var(--foreground)',
              outline: 'none',
            }}
          />
          <p
            style={{
              fontSize: 11,
              color: 'var(--muted-foreground)',
              margin: '4px 0 0',
            }}
          >
            {t('nickname.hint')}
          </p>
        </div>

        {/* 생년월일 입력 — native date picker */}
        <div>
          <label
            htmlFor="birth-date"
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--muted-foreground)',
              marginBottom: 6,
            }}
          >
            {t('birth.date')}
          </label>
          <DateWheelField
            id="birth-date"
            value={birthDate}
            onChange={setBirthDate}
            min={MIN_DATE}
            max={MAX_DATE}
            label={t('birth.date')}
            placeholder={t('birth.datePlaceholder')}
          />
        </div>
      </div>
    </div>
  );
}
