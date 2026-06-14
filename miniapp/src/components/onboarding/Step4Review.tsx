/**
 * Step4Review.tsx — Step 4: 검수(확인) + AI 고지 + 제출
 *
 * 웹앱 원본: src/app/(app)/onboarding/review/page.tsx
 * 변경사항:
 *   - guest/legal consent 플로우 제거 (미니앱은 Toss 로그인 전제)
 *   - 직접 fetch → apiFetch 사용 (Bearer 자동 첨부)
 *   - trackEvent 제거 (analytics P4 별도)
 *   - 성공 시 navigate('/') — 오늘 케미 홈
 *
 * AiDisclosureNotice는 검수 단계 인라인 배치 (1G §6.4 법적 의무).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { AiDisclosureNotice } from '@/components/ai-disclosure/ai-disclosure-notice';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiFetch } from '@/lib/api/client';
import { useOnboardingDraft } from '@/lib/onboarding/draft-store';

interface OnboardingRequest {
  nickname: string;
  birth_date: string;
  birth_date_calendar: 'solar' | 'lunar';
  is_lunar_leap: boolean;
  birth_time_knowledge: 'exact' | 'approximate' | 'unknown';
  birth_time: string | null;
  gender: 'M' | 'F';
}

interface Step4ReviewProps {
  onSubmitSuccess: () => void;
}

export function Step4Review({ onSubmitSuccess }: Step4ReviewProps) {
  const t = useTranslations('onboarding');
  const navigate = useNavigate();
  const { token } = useAuth();
  const draft = useOnboardingDraft();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { nickname, birthDate, calendar, knowledge, birthTime, gender } = draft;

  // 요약 행 목록 (웹앱 동일 구조)
  const summary: { label: string; value: string }[] = [
    { label: t('nickname.label'), value: nickname },
    { label: t('birth.date'), value: birthDate },
    {
      label: t('birth.calendar'),
      value: t(calendar === 'solar' ? 'birth.calendarSolar' : 'birth.calendarLunar'),
    },
    {
      label: t('birth.timeOptional'),
      value: knowledge === 'unknown' ? t('birth.timeAccuracy.unknown') : birthTime,
    },
    {
      label: t('gender.label'),
      value: gender === 'M' ? t('gender.male') : t('gender.female'),
    },
  ];

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
      };

      await apiFetch('/api/onboarding', {
        method: 'POST',
        token,
        body,
      });

      // 성공 — draft 초기화 후 홈으로
      draft.reset();
      onSubmitSuccess();
      navigate('/');
    } catch {
      setError(t('errors.generic'));
      setSubmitting(false);
    }
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
          {t('step4.headline')}
        </h1>
        <p
          style={{
            font: 'var(--t-sub)',
            color: 'var(--muted-foreground)',
            margin: '8px 0 0',
          }}
        >
          {t('step4.body')}
        </p>
      </div>

      {/* 요약 카드 */}
      <div
        style={{
          borderRadius: 'var(--r-md)',
          backgroundColor: 'var(--card)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {summary.map((s) => (
          <div
            key={s.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 0',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{s.label}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {s.value || '—'}
            </span>
          </div>
        ))}
      </div>

      {/* AI 생성 고지 (§6.4 법적 의무 — 1G) */}
      <AiDisclosureNotice />

      {/* 개인정보 안내 */}
      <p
        style={{
          fontSize: 11,
          color: 'var(--muted-foreground)',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {t('privacy')}
      </p>

      {/* 에러 메시지 */}
      {error && (
        <p
          style={{
            font: 'var(--t-sub)',
            color: 'var(--destructive)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      {/* 하단 CTA — CtaBar 를 외부에서 렌더하므로 여기서는 bottom padding 여백만 */}
      <div style={{ height: 80 }} aria-hidden="true" />

      {/* 제출 버튼 — 이 step 은 onSubmit 이 필요하므로 내부 렌더 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          background: 'var(--background)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          style={{
            height: 48,
            width: '100%',
            maxWidth: 448,
            display: 'block',
            margin: '0 auto',
            borderRadius: 'var(--r-pill)',
            fontWeight: 700,
            fontSize: 16,
            border: 'none',
            backgroundColor: submitting ? 'var(--muted)' : 'var(--primary)',
            color: submitting ? 'var(--muted-foreground)' : 'var(--primary-foreground)',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? t('submitting') : t('submit')}
        </button>
      </div>
    </div>
  );
}
