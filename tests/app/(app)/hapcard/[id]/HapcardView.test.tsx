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
        amount_krw: 500,
      }),
    });

    renderWithProviders(<HapcardView />);

    expect(await screen.findByTestId('feature-pay-sheet')).toBeInTheDocument();
    expect(
      screen.queryByText('오늘 케미를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeNull();
  });

  it('PAYMENT_REQUIRED(402) 이지만 ref 누락 → 결제 시트 대신 코드별 에러 카드', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: { code: 'PAYMENT_REQUIRED', message: 'payment required' },
        feature: 'hapcard',
        amount_krw: 500,
      }),
    });

    renderWithProviders(<HapcardView />);

    expect(
      await screen.findByText('이번 사용은 결제가 필요해요. 결제하고 결과를 확인해보세요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
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

  it('일반 에러(INTERNAL_ERROR) → 에러 카드와 재시도 버튼, 결제 시트 미노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR' } }),
    });

    renderWithProviders(<HapcardView />);

    expect(
      await screen.findByText('잠시 문제가 생겼어요. 다시 시도해주세요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
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

describe('HapcardView 별명 수정', () => {
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

  it('별명 수정 메뉴를 누르면 현재 별명이 채워진 팝업을 연다', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => withVisuals({ relation_nickname: '민지' }),
    });

    renderWithProviders(<HapcardView />);

    await user.click(await screen.findByRole('button', { name: 'more' }));
    await user.click(await screen.findByRole('button', { name: '별명 수정' }));

    expect(screen.getByRole('dialog', { name: '별명 수정' })).toBeInTheDocument();
    expect(screen.getByLabelText('별명')).toHaveValue('민지');
  });

  it('별명 저장 성공 시 PATCH 호출 후 화면 별명과 관련 캐시를 갱신한다', async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/hapcards' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => withVisuals({ relation_nickname: '민지' }),
        });
      }
      if (url === '/api/relations/hap-1' && init?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            relation: {
              relation_id: 'hap-1',
              nickname: '새별명',
              mode: '일합',
              created_at: '2026-05-01T00:00:00Z',
            },
          }),
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
    await user.click(await screen.findByRole('button', { name: '별명 수정' }));
    const input = screen.getByLabelText('별명');
    await user.clear(input);
    await user.type(input, '새별명');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/relations/hap-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ nickname: '새별명' }),
        }),
      ),
    );
    expect(await screen.findByText(/일 관계 · 새별명/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '별명 수정' })).toBeNull();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['feed'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['relations'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['today'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['relation-detail', 'hap-1'] });
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

// G-5 (2026-06-13 D7): 쉽게 보기 토글 — 본문 명리 용어 평이어 전환 (ADR-023 강화)
describe('HapcardView 쉽게 보기 토글 (G-5)', () => {
  beforeEach(() => window.localStorage.clear());

  it('저장된 선호가 없으면 쉽게 보기가 기본 ON 으로 노출된다', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () =>
        withVisuals({
          content: {
            main_text: '결론 = 비견 교차로 동료감이 큽니다.',
            cause_factors: [],
            classic_citation: [],
            actions: [],
            why_cards: [],
          } as never,
        }),
    });

    renderWithProviders(<HapcardView />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: '더 자세히 펼쳐보기' }));
    expect(screen.getByRole('switch', { name: '쉽게 보기' })).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText(/나와 같은 기운 교차/)).toBeInTheDocument();
    expect(screen.queryByText(/비견 교차/)).toBeNull();
  });

  it('OFF 토글 상태는 localStorage 에 보존된다', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () =>
        withVisuals({
          content: {
            main_text: '결론 = 비견 교차로 동료감이 큽니다.',
            cause_factors: [],
            classic_citation: [],
            actions: [],
            why_cards: [],
          } as never,
        }),
    });

    renderWithProviders(<HapcardView />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '더 자세히 펼쳐보기' }));
    await user.click(screen.getByRole('switch', { name: '쉽게 보기' }));

    expect(window.localStorage.getItem('hapcard_easy_mode')).toBe('0');
    expect(await screen.findByText(/비견 교차/)).toBeInTheDocument();
    expect(screen.queryByText(/나와 같은 기운 교차/)).toBeNull();
  });

  it('저장된 OFF 선호가 있으면 원문 보기로 시작한다', async () => {
    window.localStorage.setItem('hapcard_easy_mode', '0');
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () =>
        withVisuals({
          content: {
            main_text: '결론 = 비견 교차로 동료감이 큽니다.',
            cause_factors: [],
            classic_citation: [],
            actions: [],
            why_cards: [],
          } as never,
        }),
    });

    renderWithProviders(<HapcardView />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '더 자세히 펼쳐보기' }));

    expect(screen.getByRole('switch', { name: '쉽게 보기' })).toHaveAttribute('aria-checked', 'false');
    expect(await screen.findByText(/비견 교차/)).toBeInTheDocument();
    expect(screen.queryByText(/나와 같은 기운 교차/)).toBeNull();
  });
});

// G-4 (2026-06-13): 시간 미상 시나리오 추정 — 점수 옆 ± 인라인 + 배지 (FGI §13.2, ADR-024)
describe('HapcardView 시나리오 추정 표시 (G-4)', () => {
  it('scenario_estimate 존재 시 ± 범위 인라인과 추정 배지를 렌더한다', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () =>
        withVisuals({
          score_breakdown: {
            hap_chung_hyung_hae: 20, sipsin: 18, ohaeng: 22, yunse_adjustment: 0, mode_adjustment: 13,
            scenario_estimate: { is_estimated: true, display_score: 71, display_range: 10, needs_badge: false },
          },
        }),
    });

    renderWithProviders(<HapcardView />);

    // display_range 10점 = ±0.5°C (20점/1°C)
    expect(await screen.findByText('±0.5°C')).toBeInTheDocument();
    expect(screen.getByText(/시나리오 추정/)).toBeInTheDocument();
  });

  it('scenario_estimate 없으면(기존 캐시 row 포함) ± 인라인 미노출', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => withVisuals({}),
    });

    renderWithProviders(<HapcardView />);
    await screen.findByTestId('ai-disclosure-badge');

    expect(screen.queryByText(/±.*°C/)).toBeNull();
    expect(screen.queryByText(/시나리오 추정/)).toBeNull();
  });
});

// H-2 (2026-06-13): 변화 폭 인디케이터 — 근거 탭 1단 (ADR-033/036)
describe('HapcardView 변화 폭 인디케이터 (H-2)', () => {
  function mockWithChange(change: unknown) {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/change')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => change });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => withVisuals({}) });
    });
  }

  it('근거 탭 진입 시 변화 인디케이터 마운트 + 요인 라벨 렌더', async () => {
    mockWithChange({
      status: 'comparable',
      delta: 5,
      factors: [{ factor: 'hap_chung_hyung_hae', delta: 4 }],
    });

    renderWithProviders(<HapcardView />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: '더 자세히 펼쳐보기' }));
    await user.click(screen.getByRole('button', { name: '근거' }));

    expect(await screen.findByTestId('hapcard-change')).toBeInTheDocument();
    expect(await screen.findByTestId('hapcard-change-factor')).toHaveTextContent('둘 사이 작용');
  });

  it('요약 탭(기본)에서는 변화 인디케이터 미마운트 (추가 fetch 없음)', async () => {
    mockWithChange({ status: 'first', delta: null, factors: [] });

    renderWithProviders(<HapcardView />);
    await screen.findByTestId('ai-disclosure-badge');

    expect(screen.queryByTestId('hapcard-change')).toBeNull();
    expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/change'))).toBe(false);
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
