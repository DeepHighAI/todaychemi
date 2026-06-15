/**
 * routes.tsx
 *
 * HashRouter 기반 라우트 정의.
 * 정적 .ait 번들은 서버-사이드 라우팅을 지원하지 않으므로
 * 해시(#) 기반 라우팅을 사용한다.
 *
 * 모든 페이지는 현재 stub — P4에서 실제 UI 포팅 예정.
 */

import { useEffect } from 'react';
import { createHashRouter, RouterProvider, useNavigate } from 'react-router-dom';
import { getSchemeUri } from '@apps-in-toss/web-framework';
import { parseSchemeToPath } from '../lib/deeplink/parse-scheme';

// 모듈 레벨 싱글톤 가드 — 콜드스타트 딥링크는 앱 세션당 정확히 1회만 적용한다.
// (SchemeUriRouter 가 라우트 그룹 전환마다 재마운트되어도 재적용 금지 — 사용자가
//  딥링크 화면을 벗어나려 할 때 다시 끌려가는 버그 방지.)
let coldStartDeeplinkHandled = false;
import { AppShell } from '../components/shell/AppShell';
import { FeedPage } from './pages/FeedPage';
import { HapcardPage } from './pages/HapcardPage';
import { HomePage } from './pages/HomePage';
import { MePage } from './pages/MePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { RelationDetailPage } from './pages/RelationDetailPage';
import { RelationsNewPage } from './pages/RelationsNewPage';
import { WhatifPage } from './pages/WhatifPage';
import { LegalPage } from './pages/LegalPage';

// ---------------------------------------------------------------------------
// 딥링크 마운트 로깅
// ---------------------------------------------------------------------------

/**
 * 앱 최초 마운트 시 콜드스타트 딥링크 스킴을 라우트로 매핑하는 일회성 컴포넌트.
 * 렌더링 결과는 없다.
 *
 * 토스는 공유 링크로 미니앱을 실행할 때 getSchemeUri() 에 초기 경로를 전달한다.
 * WebView 는 항상 기본 URL(#/)에서 시작하므로, 여기서 경로를 파싱해 1회 navigate 한다.
 *   예) intoss://todaychemi/hapcard/abc123 → navigate('/hapcard/abc123')
 */
function SchemeUriRouter() {
  const navigate = useNavigate();

  useEffect(() => {
    // 콜드스타트 1회만 — 이후 재마운트·StrictMode 이중 마운트 시 무시.
    if (coldStartDeeplinkHandled) return;
    coldStartDeeplinkHandled = true;

    try {
      const schemeUri = getSchemeUri();
      const target = parseSchemeToPath(schemeUri);
      if (target) {
        navigate(target, { replace: true });
      }
    } catch {
      // 웹 dev 환경에서는 getSchemeUri() 가 없을 수 있음 — 무시(루트 유지).
    }
  }, [navigate]);

  return null;
}

// ---------------------------------------------------------------------------
// 라우터 구성
// ---------------------------------------------------------------------------

const router = createHashRouter([
  {
    // 탭바 있는 메인 레이아웃
    element: (
      <>
        <SchemeUriRouter />
        <AppShell showNav />
      </>
    ),
    children: [
      { path: '/',                        element: <HomePage /> },
      { path: '/feed',                    element: <FeedPage /> },
      { path: '/feed/:relationId',        element: <RelationDetailPage /> },
      { path: '/me',                      element: <MePage /> },
    ],
  },
  {
    // 탭바 없는 단독 화면 레이아웃 (온보딩, 케미카드 뷰어, 진단)
    element: (
      <>
        <SchemeUriRouter />
        <AppShell showNav={false} />
      </>
    ),
    children: [
      { path: '/onboarding',              element: <OnboardingPage /> },
      { path: '/relations/new',           element: <RelationsNewPage /> },
      { path: '/hapcard/:id',             element: <HapcardPage /> },
      { path: '/whatif/:type',            element: <WhatifPage /> },
      { path: '/legal/:slug',             element: <LegalPage /> },
    ],
  },
]);

// ---------------------------------------------------------------------------
// 내보내기
// ---------------------------------------------------------------------------

export function AppRouter() {
  return <RouterProvider router={router} />;
}
