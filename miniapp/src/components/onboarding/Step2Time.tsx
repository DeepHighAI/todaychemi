/**
 * Step2Time.tsx — Step 2: 태어난 시간 입력
 *
 * 웹앱 원본: src/app/(app)/onboarding/time/page.tsx
 * 변경사항:
 *   - BirthTimeField(wheel picker) → native <input type="time">
 *   - next-intl useTranslations 유지
 */

import { useTranslations } from 'next-intl';
import { useOnboardingDraft, type TimeAccuracy } from '@/lib/onboarding/draft-store';

// 시간 정확도 옵션 순서 (웹앱과 동일)
const ACCURACY_OPTIONS: TimeAccuracy[] = ['exact', 'approximate', 'unknown'];

export function Step2Time() {
  const t = useTranslations('onboarding');
  const { knowledge, setKnowledge, birthTime, setBirthTime } = useOnboardingDraft();

  // 'approximate' → i18n key 는 'estimated' 로 매핑 (웹앱 동일 로직)
  function accuracyLabel(v: TimeAccuracy): string {
    const key = v === 'approximate' ? 'estimated' : v;
    return t(`birth.timeAccuracy.${key}`);
  }

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
          {t('step2.headline')}
        </h1>
        <p
          style={{
            font: 'var(--t-sub)',
            color: 'var(--muted-foreground)',
            margin: '8px 0 0',
          }}
        >
          {t('step2.body')}
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
        {/* 시간 정확도 선택 */}
        <div
          role="radiogroup"
          aria-label={t('birth.time')}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}
        >
          {ACCURACY_OPTIONS.map((v) => {
            const selected = knowledge === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setKnowledge(v)}
                style={{
                  padding: '12px 0',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 12,
                  fontWeight: 600,
                  border: selected ? 'none' : '1px solid var(--border)',
                  backgroundColor: selected ? 'var(--p-40)' : 'var(--surface-1)',
                  color: selected ? '#ffffff' : 'var(--foreground)',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s, color 0.15s',
                }}
              >
                {accuracyLabel(v)}
              </button>
            );
          })}
        </div>

        {/* 시간 입력 — unknown 제외 */}
        {knowledge !== 'unknown' && (
          <div>
            <label
              htmlFor="birth-time"
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--muted-foreground)',
                marginBottom: 6,
              }}
            >
              {t('birth.timeOptional')}
            </label>
            <input
              id="birth-time"
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 'var(--r-sm)',
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border)',
                padding: '12px 14px',
                fontSize: 15,
                color: birthTime ? 'var(--foreground)' : 'var(--muted-foreground)',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* 시간 모를 때 안내 */}
        {knowledge === 'unknown' && (
          <p
            style={{
              fontSize: 12,
              color: 'var(--muted-foreground)',
              margin: 0,
            }}
          >
            {t('birth.timeUnknownHint')}
          </p>
        )}
      </div>
    </div>
  );
}
