/**
 * OnboardingPage.tsx — 온보딩 4-step 단일 페이지 (미니앱 SPA 포트)
 *
 * 웹앱 원본:
 *   - src/app/(app)/onboarding/layout.tsx         (진행 바 + 헤더)
 *   - src/app/(app)/onboarding/dob/page.tsx        (Step 1: 별명 + 생년월일)
 *   - src/app/(app)/onboarding/time/page.tsx       (Step 2: 태어난 시간)
 *   - src/app/(app)/onboarding/cal-gender/page.tsx (Step 3: 달력 + 성별)
 *   - src/app/(app)/onboarding/review/page.tsx     (Step 4: 검수 + 제출)
 *
 * 미니앱 SPA 변환 규칙:
 *   - 웹앱의 URL 서브라우트(/onboarding/dob, /time, ...)를 단일 HashRoute(/onboarding) +
 *     로컬 step 상태로 대체 (HashRouter 서브라우트 없음).
 *   - next/navigation → react-router-dom (useNavigate).
 *   - 게스트/법적 동의 플로우 없음 — 미니앱은 Toss appLogin() 이후 진입 전제.
 *   - AccessGuard: useAuth().isAuthed 미확인 시 홈(/)으로 redirect.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useOnboardingDraft } from '@/lib/onboarding/draft-store';
import { LoadingState } from '@/components/feedback/LoadingState';
import { StepHeader } from '@/components/onboarding/StepHeader';
import { CtaBar } from '@/components/onboarding/CtaBar';
import { Step1NicknameDob } from '@/components/onboarding/Step1NicknameDob';
import { Step2Time } from '@/components/onboarding/Step2Time';
import { Step3CalGender } from '@/components/onboarding/Step3CalGender';
import { Step4Review } from '@/components/onboarding/Step4Review';
import { useTranslations } from 'next-intl';

// ---------------------------------------------------------------------------
// Step 유효성 검사 헬퍼
// ---------------------------------------------------------------------------

function useStepValidation() {
  const { nickname, birthDate, knowledge, birthTime, gender } = useOnboardingDraft();

  function canAdvanceFrom(step: number): boolean {
    switch (step) {
      case 1:
        // 별명 1글자 이상 + 생년월일 있음
        return nickname.trim().length > 0 && !!birthDate;
      case 2:
        // 시간 모름이거나 시간 입력됨
        return knowledge === 'unknown' || !!birthTime;
      case 3:
        // 성별 선택됨 (calendar 는 기본값 'solar' 있음)
        return !!gender;
      case 4:
        // Step 4 는 자체 submit 버튼 사용 — CtaBar 미렌더
        return true;
      default:
        return false;
    }
  }

  return { canAdvanceFrom };
}

// ---------------------------------------------------------------------------
// 메인 페이지
// ---------------------------------------------------------------------------

export function OnboardingPage() {
  const t = useTranslations('onboarding');
  const navigate = useNavigate();
  const { isAuthed, isLoading } = useAuth();

  // 현재 step (1~4)
  const [step, setStep] = useState(1);
  const { canAdvanceFrom } = useStepValidation();

  // 미인증 사용자 리다이렉트 — Toss WebView 에서는 appLogin() 이후에만 진입하므로
  // 이론상 isAuthed=false 는 없으나 방어 목적으로 유지.
  useEffect(() => {
    if (!isLoading && !isAuthed) {
      navigate('/', { replace: true });
    }
  }, [isAuthed, isLoading, navigate]);

  // 인증 로딩 중
  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <LoadingState />
      </div>
    );
  }

  // 미인증 — 리다이렉트 진행 중, 빈 화면
  if (!isAuthed) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // 네비게이션
  // ---------------------------------------------------------------------------

  function handleBack() {
    if (step === 1) {
      // 첫 step 에서 뒤로가기 → 앱 홈
      navigate('/');
    } else {
      setStep((s) => s - 1);
    }
  }

  function handleNext() {
    if (step < 4) {
      setStep((s) => s + 1);
    }
  }

  // Step 4 제출 성공 콜백 (Step4Review 내부에서 navigate('/') 호출)
  function handleSubmitSuccess() {
    // draft.reset() 은 Step4Review 내부에서 실행됨
    setStep(1); // 다음 온보딩 진입에 대비
  }

  // ---------------------------------------------------------------------------
  // 렌더
  // ---------------------------------------------------------------------------

  return (
    <main
      style={{
        backgroundColor: 'var(--background)',
        minHeight: '100vh',
        // Step 4 는 자체 CTA 버튼 사용, 나머지는 CtaBar 공간 확보
        paddingBottom: step < 4 ? 80 : 0,
      }}
    >
      <StepHeader step={step} onBack={handleBack} />

      {/* 각 Step 콘텐츠 */}
      {step === 1 && <Step1NicknameDob />}
      {step === 2 && <Step2Time />}
      {step === 3 && <Step3CalGender />}
      {step === 4 && <Step4Review onSubmitSuccess={handleSubmitSuccess} />}

      {/* Step 1~3 공통 CTA (Step 4 는 자체 제출 버튼 사용) */}
      {step < 4 && (
        <CtaBar
          label={t('next')}
          disabled={!canAdvanceFrom(step)}
          onClick={handleNext}
        />
      )}
    </main>
  );
}
