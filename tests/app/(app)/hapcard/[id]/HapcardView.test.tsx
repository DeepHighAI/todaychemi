// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { renderWithProviders } from '../../../../utils/render-with-providers';
import { GlossaryProvider } from '@/components/hapcard/glossary-provider';
import HapcardView from '@/app/(app)/hapcard/[id]/HapcardView';
import { withVisuals } from '../../../../fixtures/hapcard';
import messages from '../../../../../messages/ko.json';

const mockFetch = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'hap-1' }),
  useSearchParams: () => new URLSearchParams({ mode: '일합' }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

// G-8: GA 배선 검증용 mock
vi.mock('@/lib/analytics/ga', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/analytics/ga')>();
  return { ...mod, trackEvent: vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HapcardView 402 결제 처리', () => {
  it('PAYMENT_REQUIRED(402) → 결제 시트 렌더, generic 에러 미노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: { code: 'PAYMENT_REQUIRED', message: 'payment required' },
        feature: 'hapcard',
        ref: 'cache-abc',
        amount_krw: 800,
      }),
    });

    renderWithProviders(<HapcardView />);

    expect(await screen.findByTestId('feature-pay-sheet')).toBeInTheDocument();
    expect(
      screen.queryByText('오늘 케미를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeNull();
  });

  it('PAYMENT_REQUIRED(402) 이지만 ref 누락 → 결제 시트 대신 generic 안내', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: { code: 'PAYMENT_REQUIRED', message: 'payment required' },
        feature: 'hapcard',
        amount_krw: 800,
      }),
    });

    renderWithProviders(<HapcardView />);

    expect(
      await screen.findByText('오늘 케미를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('feature-pay-sheet')).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('인연 차트 준비 중(RELATION_CHART_NOT_FOUND) → 차트 준비 안내, 결제 시트 미노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: { code: 'RELATION_CHART_NOT_FOUND' } }),
    });

    renderWithProviders(<HapcardView />);

    expect(await screen.findByText('오늘 케미 준비 중')).toBeInTheDocument();
    expect(screen.queryByTestId('feature-pay-sheet')).toBeNull();
  });

  it('일반 에러(INTERNAL_ERROR) → generic 안내, 결제 시트 미노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR' } }),
    });

    renderWithProviders(<HapcardView />);

    expect(
      await screen.findByText('오늘 케미를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('feature-pay-sheet')).toBeNull();
  });
});

describe('HapcardView 인연 삭제 캐시 무효화', () => {
  function renderWithQueryClient(queryClient: QueryClient) {
    return render(
      <NextIntlClientProvider locale="ko" messages={messages}>
        <QueryClientProvider client={queryClient}>
          <GlossaryProvider>
            <HapcardView />
          </GlossaryProvider>
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );
  }

  it('인연 삭제 성공 시 feed/relations 뿐 아니라 today 캐시도 무효화한다', async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/hapcards' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => withVisuals({ relation_nickname: '민지' }),
        });
      }
      if (url === '/api/relations/hap-1' && init?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithQueryClient(queryClient);

    await user.click(await screen.findByRole('button', { name: 'more' }));
    await user.click(await screen.findByRole('button', { name: '인연 삭제' }));
    expect(await screen.findByText('민지 인연을 삭제할까요?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '삭제' }));

    expect(await screen.findByText('삭제했어요')).toBeInTheDocument();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['feed'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['relations'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['today'] });
  });
});

describe('HapcardView AI 생성 고지 (1G)', () => {
  it('정상 렌더 시 케미카드 hero 에 AI 생성 배지를 노출한다', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => withVisuals({ relation_nickname: '민지' }),
    });

    renderWithProviders(<HapcardView />);

    expect(await screen.findByTestId('ai-disclosure-badge')).toBeInTheDocument();
  });
});

describe('HapcardView GA 퍼널 이벤트 (G-8)', () => {
  it('성공 데이터 도달 시 hapcard_view 이벤트 발화', async () => {
    const { trackEvent } = await import('@/lib/analytics/ga');
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => withVisuals({ relation_nickname: '민지' }),
    });

    renderWithProviders(<HapcardView />);
    await screen.findByTestId('ai-disclosure-badge');

    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith({ name: 'hapcard_view', params: { mode: '일합' } }),
    );
  });
});
