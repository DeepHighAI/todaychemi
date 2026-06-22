/**
 * AppShell.tsx
 *
 * 앱 전체 레이아웃 컨테이너.
 * - 상단 콘텐츠 영역 + 하단 AppNav (오늘 / 피드 / 나)
 * - 뒤로 가기 버튼: graniteEvent.addEventListener('backEvent', ...) 등록
 *   → 앱 내부 스택이 있으면 navigate(-1), 없으면 closeView 로 서비스 종료
 * - 홈 버튼: graniteEvent.addEventListener('homeEvent', ...) 등록
 *   → 서비스 진입점(/)으로 replace 이동
 * - 페이지 이탈(pagehide) 시 이벤트 리스너 정리
 */

import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { graniteEvent } from '@apps-in-toss/web-framework';
import { AppNav } from './AppNav';
import { useAuth } from '@/lib/auth/AuthProvider';
import { restorePendingOrders } from '@/lib/iap/purchase';
import { closeMiniappView } from '@/lib/navigation/close-view';
import { RewardGate } from '@/components/rewards/reward-gate';

// ---------------------------------------------------------------------------
// 탭 정의
// ---------------------------------------------------------------------------

/** 탭 아이콘 — 인라인 SVG (외부 의존 없음, TDS 아이콘 교체 예정) */
function HomeIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V10.5z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 21V12h6v9"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x={3}
        y={3}
        width={8}
        height={8}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.8}
      />
      <rect
        x={13}
        y={3}
        width={8}
        height={8}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.8}
      />
      <rect
        x={3}
        y={13}
        width={8}
        height={8}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.8}
      />
      <rect
        x={13}
        y={13}
        width={8}
        height={8}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.8}
      />
    </svg>
  );
}

function MeIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx={12} cy={8} r={4} stroke="currentColor" strokeWidth={1.8} />
      <path
        d="M4 20c0-4 3.582-7 8-7s8 3 8 7"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 탭 목록 */
const NAV_ITEMS = [
  { to: '/',    label: '오늘', icon: <HomeIcon /> },
  { to: '/feed', label: '피드', icon: <FeedIcon /> },
  { to: '/me',  label: '나',   icon: <MeIcon /> },
] as const;

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

interface AppShellProps {
  /** 탭바를 표시하지 않는 라우트(온보딩, 딥합 뷰어 등)에서 숨길 수 있음 */
  showNav?: boolean;
}

export function AppShell({ showNav = true }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const queryClient = useQueryClient();
  const { token, isAuthed } = useAuth();
  const stackDepthRef = useRef(0);
  const lastLocationKeyRef = useRef(location.key);

  // 미결 IAP 주문 복구 — 앱 마운트 + 인증 완료 시 best-effort
  useEffect(() => {
    if (!isAuthed) return;
    void restorePendingOrders(token);
  }, [isAuthed, token]);

  // 포그라운드 복귀(가시성 visible) 시 데이터 새로고침 + 미결 IAP 주문 재복구.
  // WebView 에서 'focus' 는 불안정하므로 'visibilitychange' 로 앱 재개를 감지한다.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      void queryClient.invalidateQueries();
      if (isAuthed) void restorePendingOrders(token);
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [queryClient, isAuthed, token]);

  // 앱 내부 history depth 추적 — 네이티브 backEvent 의 close/back 분기 기준.
  useEffect(() => {
    if (lastLocationKeyRef.current === location.key) return;

    if (navigationType === 'PUSH') {
      stackDepthRef.current += 1;
    } else if (navigationType === 'POP') {
      stackDepthRef.current = Math.max(0, stackDepthRef.current - 1);
    }

    lastLocationKeyRef.current = location.key;
  }, [location.key, navigationType]);

  // 네이티브 뒤로 가기 버튼 → 내부 스택 back, 스택이 없으면 서비스 종료.
  useEffect(() => {
    const removeBackListener = graniteEvent.addEventListener('backEvent', {
      onEvent: () => {
        if (stackDepthRef.current > 0) {
          navigate(-1);
          return;
        }

        void closeMiniappView().catch((error: Error) => {
          console.warn('[AppShell] closeView 오류:', error);
        });
      },
      onError: (error: Error) => {
        console.warn('[AppShell] backEvent 오류:', error);
      },
    });
    const removeHomeListener = graniteEvent.addEventListener('homeEvent', {
      onEvent: () => {
        stackDepthRef.current = 0;
        navigate('/', { replace: true });
      },
      onError: (error: Error) => {
        console.warn('[AppShell] homeEvent 오류:', error);
      },
    });

    // pagehide(탭 전환·앱 백그라운드 진입) 시 정리
    function handlePageHide() {
      removeBackListener();
      removeHomeListener();
    }
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      removeBackListener();
      removeHomeListener();
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [navigate]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        // 탭바 높이만큼 콘텐츠 영역 하단에 여백 확보
        paddingBottom: showNav ? 'var(--tabbar-h)' : 0,
      }}
    >
      {/* 개별 페이지 렌더링 영역 */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        <Outlet />
      </main>

      {/* 하단 탭바 */}
      {showNav && <AppNav items={[...NAV_ITEMS]} />}

      {/* 부적 지급 트리거 + 팝업 (가입 +50 / 매일 +5, 항목 6/7) */}
      <RewardGate />
    </div>
  );
}
