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
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AiDisclosureNotice } from '@/components/ai-disclosure/ai-disclosure-notice';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiFetch, ApiError } from '@/lib/api/client';
import { useOnboardingDraft } from '@/lib/onboarding/draft-store';
import { LegalConsentBlock, type LegalDocSlug } from '@/components/legal/legal-consent-block';
import { LegalDocSheet } from '@/components/legal/legal-doc-sheet';

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
  const { token, login } = useAuth();
  const queryClient = useQueryClient();
  const draft = useOnboardingDraft();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 필수 동의(약관·개인정보·연령) + 문서 보기 시트
  const [consent, setConsent] = useState({ terms: false, privacy: false, age: false });
  const [docSlug, setDocSlug] = useState<LegalDocSlug | null>(null);

  const allAgreed = consent.terms && consent.privacy && consent.age;

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

      // 1) 법적 동의 기록(Bearer, flow='toss') — 미니앱은 쿠키 불가, /api/toss/consent 사용.
      await apiFetch('/api/toss/consent', {
        method: 'POST',
        token,
        body: { terms: true, privacy: true, age: true },
      });

      // 2) 온보딩 저장 — 위 동의가 선행돼야 LEGAL_CONSENT_REQUIRED(403) 를 피한다.
      await apiFetch('/api/onboarding', { method: 'POST', token, body });

      // 3) 새 프로필 반영 — ProfileGate 가 갱신된 chart 를 보고 홈 입장을 허용하도록 캐시 무효화.
      //    ['me-chart'] 는 await + refetchType:'all' — onboarding 화면은 ProfileGate 밖이라
      //    제출 시점에 ['me-chart'] 가 inactive 다. 기본 invalidateQueries 는 active 쿼리만
      //    리페치·await 하므로 inactive 면 즉시 리졸브(리페치 X) → navigate 후 게이트가 stale-null
      //    을 보고 방금 끝낸 온보딩으로 다시 튕긴다. refetchType:'all' 로 inactive 까지 리페치·await
      //    해 navigate 전에 실제 chart 를 캐시에 채운다. today/relations 는 fire-and-forget.
      await queryClient.invalidateQueries({ queryKey: ['me-chart'], refetchType: 'all' });
      void queryClient.invalidateQueries({ queryKey: ['today'] });
      void queryClient.invalidateQueries({ queryKey: ['relations'] });

      // 성공 — draft 초기화 후 홈으로
      draft.reset();
      onSubmitSuccess();
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // 세션 만료 — Toss 재로그인 유도 후 재시도 가능하게 버튼 재활성.
        // 재로그인 자체가 실패하면(드묾) 거부를 삼키지 않고 복구 가능한 안내로 폴백한다
        // (stale token 으로 무한 수동 재시도에 갇히는 것 방지).
        setError(t('errors.session'));
        void login().catch(() => setError(t('errors.generic')));
      } else if (err instanceof ApiError && err.status === 403) {
        // 동의 미기록(방어적) — 동의 안내.
        setError(t('errors.consent'));
      } else {
        setError(t('errors.generic'));
      }
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

      {/* 필수 동의 (약관·개인정보·연령) — 제출 게이트 */}
      <LegalConsentBlock
        value={consent}
        onChange={setConsent}
        disabled={submitting}
        onViewDocument={setDocSlug}
      />
      <LegalDocSheet
        slug={docSlug}
        open={docSlug !== null}
        onOpenChange={(open) => {
          if (!open) setDocSlug(null);
        }}
      />

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
          disabled={submitting || !allAgreed}
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
            backgroundColor: submitting || !allAgreed ? 'var(--muted)' : 'var(--primary)',
            color: submitting || !allAgreed ? 'var(--muted-foreground)' : 'var(--primary-foreground)',
            cursor: submitting || !allAgreed ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? t('submitting') : t('submit')}
        </button>
      </div>
    </div>
  );
}
