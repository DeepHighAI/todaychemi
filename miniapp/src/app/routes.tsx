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
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { getSchemeUri } from '@apps-in-toss/web-framework';
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
 * 앱 최초 마운트 시 스킴 URI 를 콘솔에 출력하는 일회성 컴포넌트.
 * 렌더링 결과는 없다.
 *
 * TODO(P4): 여기서 파싱한 스킴 URI 를 실제 라우트 경로로 매핑.
 *   예) intoss://todaychemi/hapcard/abc123 → /hapcard/abc123
 */
function SchemeUriLogger() {
  useEffect(() => {
    try {
      const schemeUri = getSchemeUri();
      // TODO(P4): map cold-entry deeplink to route
      console.log('[todaychemi] 초기 진입 스킴 URI:', schemeUri);
    } catch (err) {
      // 웹 dev 환경에서는 getSchemeUri() 가 없을 수 있음
      console.warn('[todaychemi] getSchemeUri() 미지원 환경:', err);
    }
  }, []);

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
        <SchemeUriLogger />
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
        <SchemeUriLogger />
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
