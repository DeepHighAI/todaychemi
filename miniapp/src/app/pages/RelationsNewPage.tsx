/**
 * RelationsNewPage.tsx — 인연 등록 3-스텝 플로우
 *
 * 웹앱 src/app/(app)/relations/new/{name,dob-time,mode}/page.tsx 포트.
 *
 * 웹앱은 URL 서브라우트 (/relations/new/name → /dob-time → /mode) 로 스텝을 구분하지만
 * SPA(HashRouter)에서는 /relations/new 단일 경로 안에서 로컬 step state 로 관리한다.
 * routes.tsx 변경 없이 기존 { path: '/relations/new', element: <RelationsNewPage /> } 사용.
 *
 * 결제 흐름:
 *   POST /api/relations → 402 PAYMENT_REQUIRED(relation_slot) 수신 시
 *   Step3ModeConsent 내부의 플레이스홀더 UI 표시.
 *   TODO(P5 IAP): Toss IAP 시트 연결.
 *
 * 인연 차트 eager compute:
 *   서버 API(POST /api/relations) 내부에서 insert_relation_if_under_free_cap RPC 가
 *   relations INSERT 를 수행하고, hapcard route 진입 시 lazy-relation-chart 가
 *   relation_charts 를 자동 생성한다. 클라이언트에서 별도 compute 호출 없음.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRelationDraft } from '@/lib/relations/draft-store';
import { StepHeader } from '@/components/relations/StepHeader';
import { Step1NameGender } from '@/components/relations/Step1NameGender';
import { Step2DobTime } from '@/components/relations/Step2DobTime';
import { Step3ModeConsent } from '@/components/relations/Step3ModeConsent';

type StepIndex = 1 | 2 | 3;

const TOTAL_STEPS = 3;

export function RelationsNewPage() {
  const navigate = useNavigate();
  const draft = useRelationDraft();

  const [step, setStep] = useState<StepIndex>(1);

  // 뒤로가기 — 첫 스텝이면 이전 페이지(피드)로
  function handleBack() {
    if (step === 1) {
      navigate(-1);
    } else {
      setStep((s) => (s - 1) as StepIndex);
    }
  }

  // 스텝 1 완료 핸들러
  function handleStep1Next(nickname: string, gender: 'M' | 'F') {
    draft.setNickname(nickname);
    draft.setGender(gender);
    setStep(2);
  }

  // 스텝 2 완료 핸들러
  function handleStep2Next(opts: {
    birthDate: string;
    calendar: 'solar' | 'lunar';
    knowledge: 'exact' | 'approximate' | 'unknown';
    birthTime: string;
  }) {
    draft.setBirthDate(opts.birthDate);
    draft.setCalendar(opts.calendar);
    draft.setKnowledge(opts.knowledge);
    draft.setBirthTime(opts.birthTime);
    setStep(3);
  }

  // 스텝 3 성공 핸들러 — draft 리셋, 내비게이션은 Step3 내부에서 수행
  function handleSuccess() {
    draft.reset();
  }

  // 스텝 3 에 전달할 POST body (mode/consent 제외)
  const createBody = {
    nickname: draft.nickname,
    gender: draft.gender as 'M' | 'F',
    birth_date: draft.birthDate,
    birth_date_calendar: draft.calendar,
    is_lunar_leap: false,
    birth_time_knowledge: draft.knowledge,
    birth_time: draft.knowledge === 'unknown' ? null : draft.birthTime || null,
    birth_longitude: null as null,
    is_primary: false,
  } as const;

  return (
    <main style={{ backgroundColor: 'var(--background)', minHeight: '100dvh', paddingBottom: 128 }}>
      <StepHeader current={step} total={TOTAL_STEPS} onBack={handleBack} />

      {step === 1 && (
        <Step1NameGender
          initialNickname={draft.nickname}
          initialGender={draft.gender}
          onNext={handleStep1Next}
        />
      )}

      {step === 2 && (
        <Step2DobTime
          initialBirthDate={draft.birthDate}
          initialCalendar={draft.calendar}
          initialKnowledge={draft.knowledge}
          initialBirthTime={draft.birthTime}
          onNext={handleStep2Next}
        />
      )}

      {step === 3 && (
        <Step3ModeConsent
          createBody={createBody}
          initialMode={draft.mode}
          initialConsent={draft.consent}
          onSuccess={handleSuccess}
        />
      )}
    </main>
  );
}
