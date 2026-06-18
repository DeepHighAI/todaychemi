/**
 * render.tsx — 테스트 공용 렌더 헬퍼.
 *
 * 미니앱 컴포넌트는 App.tsx 의 세 Provider 에 의존한다:
 *   QueryClientProvider · NextIntlClientProvider(ko) · (Hash)Router.
 * 테스트에서는 MemoryRouter 로 라우트를 제어한다.
 *
 * useAuth(토큰)·@apps-in-toss/web-framework SDK 는 각 테스트 파일에서 vi.mock 한다.
 */

import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { MemoryRouter } from 'react-router-dom';

import koMessages from '@/i18n/ko.json';

interface RenderOptions {
  /** MemoryRouter 초기 엔트리. useParams/useSearchParams 가 필요한 페이지용. */
  routerEntries?: string[];
}

export function renderWithProviders(ui: ReactElement, opts: RenderOptions = {}): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="ko" messages={koMessages}>
          <MemoryRouter initialEntries={opts.routerEntries ?? ['/']}>
            {children}
          </MemoryRouter>
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
