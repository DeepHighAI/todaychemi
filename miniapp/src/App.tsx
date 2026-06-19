/**
 * App.tsx — 프로바이더 루트
 *
 * 계층:
 *   QueryClientProvider  → TanStack Query 캐시 전역 공유
 *   NextIntlClientProvider → 한국어 i18n (KO 1차, SEA Phase별)
 *   AuthProvider          → Bearer 토큰 세션
 *   AppRouter             → HashRouter + 페이지들
 */

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { AuthProvider } from './lib/auth/AuthProvider';
import { AppRouter } from './app/routes';
import { ensureTossAdsInitialized } from './components/ads/ad-banner';
import koMessages from './i18n/ko.json';

// ---------------------------------------------------------------------------
// TanStack Query 클라이언트 설정
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 미니앱은 화면 전환이 빠르므로 stale 시간을 짧게 유지
      staleTime: 30_000,         // 30초
      gcTime: 5 * 60 * 1000,    // 5분 캐시 유지
      retry: 1,
      refetchOnWindowFocus: false, // WebView 포커스 이벤트가 자주 발생하므로 비활성화
    },
  },
});

// ---------------------------------------------------------------------------
// App 컴포넌트
// ---------------------------------------------------------------------------

export function App() {
  // 인앱 광고 SDK 는 앱 최상위에서 단 1회만 초기화한다(공식 BannerAd 문서 권장).
  // 각 AdBanner 는 공유 ready 상태(useTossAdsReady)를 구독해 attach 한다 — 인스턴스별
  // init + 자신의 onInitialized 안 attach 는 2번째 이후 배너가 누락될 수 있어 금지.
  useEffect(() => {
    ensureTossAdsInitialized();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/*
       * next-intl 클라이언트 전용 Provider.
       * Vite/SPA 환경에서는 서버 컴포넌트 없이 이 방식만 사용한다.
       * locale="ko" 고정 (SEA 다국어는 Phase 3 이후 locale prop 동적화).
       */}
      <NextIntlClientProvider locale="ko" messages={koMessages}>
        {/* Bearer 토큰 세션 — iOS WebView Storage SDK 기반 */}
        <AuthProvider>
          {/* HashRouter + 페이지 라우트 */}
          <AppRouter />
        </AuthProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}
