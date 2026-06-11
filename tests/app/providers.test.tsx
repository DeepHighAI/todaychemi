// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

const supabaseMocks = vi.hoisted(() => {
  const callbacks: Array<(event: string, session: unknown) => void> = [];
  const unsubscribe = vi.fn();
  const onAuthStateChange = vi.fn((callback: (event: string, session: unknown) => void) => {
    callbacks.push(callback);
    return { data: { subscription: { unsubscribe } } };
  });
  const createClient = vi.fn(() => ({ auth: { onAuthStateChange } }));

  return { callbacks, createClient, onAuthStateChange, unsubscribe };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: supabaseMocks.createClient,
}));

import Providers from '@/app/providers';

let observedQueryClient: QueryClient | null = null;

function CacheProbe() {
  const queryClient = useQueryClient();

  useEffect(() => {
    observedQueryClient = queryClient;
    queryClient.setQueryData(['me-chart'], { day_pillar: '甲子' });
  }, [queryClient]);

  return null;
}

describe('Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.callbacks.length = 0;
    observedQueryClient = null;
    window.localStorage.removeItem('theme');
    document.documentElement.classList.remove('light', 'dark');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        // prefers-color-scheme: dark 를 참으로 — 디폴트가 system 이면 dark 로 해석되는 환경
        matches: query.includes('prefers-color-scheme: dark'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    observedQueryClient = null;
  });

  it('저장된 테마가 없으면 시스템이 다크여도 라이트 모드가 디폴트다', async () => {
    render(
      <Providers>
        <CacheProbe />
      </Providers>,
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains('light')).toBe(true);
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('Supabase SIGNED_OUT 이벤트를 받으면 사용자 귀속 Query cache를 비운다', async () => {
    render(
      <Providers>
        <CacheProbe />
      </Providers>,
    );

    await waitFor(() => {
      expect(observedQueryClient?.getQueryData(['me-chart'])).toEqual({ day_pillar: '甲子' });
    });

    supabaseMocks.callbacks[0]?.('SIGNED_OUT', null);

    await waitFor(() => {
      expect(observedQueryClient?.getQueryData(['me-chart'])).toBeUndefined();
    });
  });

  it('unmount 시 Supabase auth listener를 정리한다', async () => {
    const { unmount } = render(
      <Providers>
        <CacheProbe />
      </Providers>,
    );

    await waitFor(() => expect(supabaseMocks.onAuthStateChange).toHaveBeenCalled());

    unmount();

    expect(supabaseMocks.unsubscribe).toHaveBeenCalled();
  });
});
