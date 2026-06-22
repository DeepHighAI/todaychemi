/**
 * routes.tsx
 *
 * MemoryRouter 기반 라우트 정의.
 * 앱인토스 미니앱은 SDK 콜드스타트 스킴을 내부 라우트로 매핑하므로,
 * 브라우저 History API 조작 없이 앱 내부 스택으로만 화면을 전환한다.
 *
 * 페이지 UI 포팅 완료(P4) — 8개 플로우 실구현. 유료 게이트는 IAP 시트 연동(P5).
 */

import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { getSchemeUri } from '@apps-in-toss/web-framework';
import { parseSchemeToPath } from '../lib/deeplink/parse-scheme';

// 모듈 레벨 싱글톤 가드 — 콜드스타트 딥링크는 앱 세션당 정확히 1회만 적용한다.
// StrictMode 이중 마운트 시에도 재적용하지 않아 사용자가 딥링크 화면을 벗어날 수 있게 한다.
let coldStartDeeplinkHandled = false;
import { AppShell } from '../components/shell/AppShell';
import { ProfileGate } from './ProfileGate';
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
 * WebView 는 항상 기본 URL에서 시작하므로, 여기서 경로를 파싱해 1회 navigate 한다.
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

function shouldShowMainNav(pathname: string): boolean {
  return pathname === '/' || pathname === '/me' || pathname === '/feed' || pathname.startsWith('/feed/');
}

function ShellLayout() {
  const location = useLocation();

  return (
    <>
      <SchemeUriRouter />
      <AppShell showNav={shouldShowMainNav(location.pathname)} />
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<ShellLayout />}>
        {/* 프로필 강제 게이트 — chart 없는 로그인 사용자는 온보딩으로(§1.1). */}
        {/* pathless layout route: 온보딩(탭바 없는 그룹)은 게이트 밖이라 루프 없음. */}
        <Route element={<ProfileGate />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/feed/:relationId" element={<RelationDetailPage />} />
          <Route path="/me" element={<MePage />} />
        </Route>

        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/relations/new" element={<RelationsNewPage />} />
        <Route path="/hapcard/:id" element={<HapcardPage />} />
        <Route path="/whatif/:type" element={<WhatifPage />} />
        <Route path="/legal/:slug" element={<LegalPage />} />
      </Route>
    </Routes>
  );
}

// ---------------------------------------------------------------------------
// 내보내기
// ---------------------------------------------------------------------------

export function AppRouter() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>
  );
}
