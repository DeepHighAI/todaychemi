/**
 * ProfileGate.tsx — 프로필(본명식) 강제 게이트 (탭바 그룹의 pathless layout route).
 *
 * §1.1 강제 게이트: 로그인했지만 chart(본명식)가 없는 사용자는 홈/피드/내 프로필 어느
 * 탭에서도 온보딩으로 보낸다(완료 전 앱 사용 제한). /me 의 '등록하기' 버튼은 안전망으로 유지.
 *
 * 상태별 동작:
 *   - isLoading           → LoadingState (게이트 보류, 깜빡임 방지)
 *   - 확정 미등록(chart=null) → /onboarding 으로 replace (렌더형 Navigate)
 *   - 조회 실패(isError)  → Outlet 통과 (fail-open — 일시 장애에 사용자를 가두지 않음)
 *   - chart 있음          → Outlet 통과
 *
 * 온보딩 라우트는 이 게이트 밖(탭바 없는 그룹)이라 리다이렉트 루프가 생기지 않는다.
 * AuthProvider 가 인증 로딩 동안 children 을 렌더하지 않으므로 여기 도달 시 토큰은 항상 존재한다.
 */

import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useMeChart } from '@/lib/me/use-me-chart';
import { LoadingState } from '@/components/feedback/LoadingState';

export function ProfileGate() {
  const { token } = useAuth();
  const { data, isLoading, isError } = useMeChart(token);

  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <LoadingState />
      </div>
    );
  }

  // 확정 미등록 → 온보딩 강제. 조회 실패(isError)는 fail-open 으로 통과.
  if (!isError && data === null) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
