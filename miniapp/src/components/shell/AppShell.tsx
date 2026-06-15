/**
 * AppShell.tsx
 *
 * 앱 전체 레이아웃 컨테이너.
 * - 상단 콘텐츠 영역 + 하단 AppNav (오늘 / 피드 / 나)
 * - 뒤로 가기 버튼: graniteEvent.addEventListener('backEvent', ...) 등록
 *   → Android/iOS 네이티브 뒤로 가기 키를 라우터 navigate(-1) 에 연결
 * - 페이지 이탈(pagehide) 시 이벤트 리스너 정리
 */

import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { graniteEvent } from '@apps-in-toss/web-framework';
import { AppNav } from './AppNav';
import { useAuth } from '@/lib/auth/AuthProvider';
import { restorePendingOrders } from '@/lib/iap/purchase';

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
  const { token, isAuthed } = useAuth();

  // 미결 IAP 주문 복구 — 앱 마운트 + 인증 완료 시 best-effort
  useEffect(() => {
    if (!isAuthed) return;
    void restorePendingOrders(token);
  }, [isAuthed, token]);

  // 네이티브 뒤로 가기 버튼 → 라우터 히스토리 뒤로 이동
  useEffect(() => {
    const removeBackListener = graniteEvent.addEventListener('backEvent', {
      onEvent: () => {
        navigate(-1);
      },
      onError: (error: Error) => {
        console.warn('[AppShell] backEvent 오류:', error);
      },
    });

    // pagehide(탭 전환·앱 백그라운드 진입) 시 정리
    function handlePageHide() {
      removeBackListener();
    }
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      removeBackListener();
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
    </div>
  );
}
