// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useSearchParams } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GlossaryProvider } from '@/components/hapcard/glossary-provider';
import { renderWithProviders } from '../../utils/render-with-providers';
import messages from '../../../messages/ko.json';
import type { DailyHapCard } from '@/types/dailyHap';
import type { ChartCore } from '@/types/chart';

const { mockTodayKST } = vi.hoisted(() => ({
  mockTodayKST: vi.fn(() => '2026-05-07'),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));
vi.mock('@/lib/today/kst-date', () => ({ todayKST: mockTodayKST }));

const mockPush = vi.fn();
const mockReplace = vi.fn();

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockTodayKST.mockReturnValue('2026-05-07');
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>);
  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
    replace: mockReplace,
  } as unknown as ReturnType<typeof useRouter>);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CARD: DailyHapCard = {
  headline: '좋은 에너지가 흐르는 날',
  headline_reason: '목기운이 강해요',
  avoid_phrase: '비난',
  avoid_phrase_reason: '갈등 유발',
  favorable_action: '먼저 안부 묻기',
  favorable_action_reason: '관계 활성화',
  reused_from_yesterday: false,
};

const CHART: ChartCore = {
  year_pillar: '辛未',
  month_pillar: '癸卯',
  day_pillar: '甲戌',
  hour_pillar: null,
  day_master_element: '목',
  five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
  gender_normalized: 'F',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

interface RouteResponse {
  ok: boolean;
  status?: number;
  body: unknown;
}

function setupRoutes(routes: {
  today?: RouteResponse;
  meChart?: RouteResponse;
  relations?: RouteResponse;
}) {
  mockFetch.mockImplementation((url: string) => {
    if (url === '/api/today' || url.startsWith('/api/today?')) {
      const r = routes.today ?? { ok: true, body: { ok: true, card: CARD } };
      return Promise.resolve({ ok: r.ok, status: r.status ?? 200, json: async () => r.body });
    }
    if (url === '/api/me/chart') {
      const r = routes.meChart ?? { ok: true, body: { ok: true, chart: CHART } };
      return Promise.resolve({ ok: r.ok, status: r.status ?? 200, json: async () => r.body });
    }
    if (url === '/api/relations') {
      const r = routes.relations ?? { ok: true, body: { items: [] } };
      return Promise.resolve({ ok: r.ok, status: r.status ?? 200, json: async () => r.body });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

async function renderTodayPage() {
  const { default: TodayPage } = await import('@/app/(app)/today-page-client');
  return renderWithProviders(<TodayPage />);
}

async function renderTodayPageWithQueryClient(queryClient: QueryClient) {
  const { default: TodayPage } = await import('@/app/(app)/today-page-client');
  function tree() {
    return (
      <NextIntlClientProvider locale="ko" messages={messages}>
        <QueryClientProvider client={queryClient}>
          <GlossaryProvider>
            <TodayPage />
          </GlossaryProvider>
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  }
  const view = render(tree());
  return {
    ...view,
    rerenderToday: () => view.rerender(tree()),
  };
}

describe('TodayPage (composition)', () => {
  it('TodayAppBar 제목 "오늘의 케미" 렌더', async () => {
    setupRoutes({});
    await renderTodayPage();
    expect(await screen.findByRole('heading', { level: 1, name: '오늘의 케미' })).toBeInTheDocument();
  });

  it('TodayHero headline을 card.headline에서 가져와 렌더', async () => {
    setupRoutes({});
    await renderTodayPage();
    expect(await screen.findByText('좋은 에너지가 흐르는 날')).toBeInTheDocument();
  });

  it('chart 있을 때 DateLine에 chart.day_pillar(갑술일) 렌더', async () => {
    setupRoutes({});
    await renderTodayPage();
    const dateLine = await screen.findByTestId('date-line');
    expect(dateLine.textContent).toContain('갑술일');
  });

  it('KST 날짜가 바뀌면 같은 relation 이어도 /api/today 를 다시 조회한다', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 60_000 },
      },
    });
    const todayFetchCount = () =>
      mockFetch.mock.calls.filter(([url]) => String(url) === '/api/today').length;
    const cards = [
      { ...CARD, headline: '2026-05-07 카드 본문' },
      { ...CARD, headline: '2026-05-08 카드 본문' },
    ];
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/today') {
        const card = cards.shift() ?? cards[0] ?? CARD;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, card }),
        });
      }
      if (url === '/api/me/chart') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, chart: CHART }),
        });
      }
      if (url === '/api/relations') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const view = await renderTodayPageWithQueryClient(queryClient);
    expect(await screen.findByText('2026-05-07 카드 본문')).toBeInTheDocument();
    expect(todayFetchCount()).toBe(1);

    mockTodayKST.mockReturnValue('2026-05-08');
    view.rerenderToday();

    await waitFor(() => expect(todayFetchCount()).toBe(2));
    expect(await screen.findByText('2026-05-08 카드 본문')).toBeInTheDocument();
  });

  it('chart=null이면 DateLine을 렌더하지 않는다', async () => {
    setupRoutes({ meChart: { ok: true, body: { ok: true, chart: null } } });
    await renderTodayPage();
    // today fetch은 끝나야 page가 mount된 상태가 되므로 hero가 보일 때까지 기다린다
    await screen.findByText('좋은 에너지가 흐르는 날');
    expect(screen.queryByTestId('date-line')).toBeNull();
  });

  it('relations 별명들을 RecentFeedRows에 전달', async () => {
    const items = [
      { relation_id: 'r1', nickname: '봄달이', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
      { relation_id: 'r2', nickname: '여름새', mode: '오래합', created_at: '2026-05-04T08:00:00Z' },
    ];
    setupRoutes({ relations: { ok: true, body: { items } } });
    await renderTodayPage();
    expect(await screen.findByText('봄달이')).toBeInTheDocument();
    expect(screen.getByText('여름새')).toBeInTheDocument();
  });

  it('relations 5개 초과 시 최근 5개만 RecentFeedRows에 전달 (Top-N)', async () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      relation_id: `r${i}`,
      nickname: `별명${i}`,
      mode: '친구합',
      created_at: `2026-05-${(10 - i).toString().padStart(2, '0')}T00:00:00Z`,
    }));
    setupRoutes({ relations: { ok: true, body: { items } } });
    await renderTodayPage();

    // 최신순(서버가 desc로 줌) 기준 첫 5개만 노출, 나머지(별명5/별명6)는 숨김
    expect(await screen.findByText('별명0')).toBeInTheDocument();
    expect(screen.getByText('별명4')).toBeInTheDocument();
    expect(screen.queryByText('별명5')).toBeNull();
    expect(screen.queryByText('별명6')).toBeNull();
  });

  it('today fetch 실패 시 ErrorCard 대신 fallback 홈 콘텐츠를 렌더', async () => {
    setupRoutes({
      today: { ok: false, status: 500, body: { ok: false, code: 'INTERNAL_ERROR' } },
    });
    await renderTodayPage();
    expect(await screen.findByText('기본 안내')).toBeInTheDocument();
    expect(await screen.findByText('오늘은 천천히 확인해요')).toBeInTheDocument();
    expect(screen.getByText('가벼운 정리부터 하기')).toBeInTheDocument();
    expect(screen.queryByTestId('error-card')).toBeNull();
  });

  it('chart 있을 때 WhatifTrigger 카드 렌더', async () => {
    setupRoutes({});
    await renderTodayPage();
    expect(await screen.findByRole('button', { name: '또 다른 나' })).toBeInTheDocument();
  });

  it('chart=null 이면 WhatifTrigger를 렌더하지 않는다', async () => {
    setupRoutes({ meChart: { ok: true, body: { ok: true, chart: null } } });
    await renderTodayPage();
    await screen.findByText('좋은 에너지가 흐르는 날');
    expect(screen.queryByRole('button', { name: '또 다른 나' })).toBeNull();
  });

  it('chart=null 이면 최근 인연 클릭 시 케미카드 대신 온보딩으로 안내한다', async () => {
    const user = userEvent.setup();
    setupRoutes({
      meChart: { ok: true, body: { ok: true, chart: null } },
      relations: {
        ok: true,
        body: {
          items: [
            { relation_id: 'r1', nickname: '봄달이', mode: '일합', created_at: '2026-05-05T10:00:00Z' },
          ],
        },
      },
    });
    await renderTodayPage();

    const relationName = await screen.findByText('봄달이');
    await user.click(relationName);

    expect(mockPush).toHaveBeenCalledWith('/onboarding');
    expect(mockPush).not.toHaveBeenCalledWith('/hapcard/r1?mode=%EC%9D%BC%ED%95%A9');
  });

  it('today 로딩 중에는 LoadingState 렌더', async () => {
    // today 영원히 pending → loading state 유지
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/today') return new Promise(() => {});
      if (url === '/api/me/chart') return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, chart: CHART }) });
      if (url === '/api/relations') return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [] }) });
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });
    await renderTodayPage();
    expect(await screen.findByTestId('loading-state')).toBeInTheDocument();
  });

  it('today 로딩 중에도 최근 인연 클릭으로 케미카드 진입 가능', async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/today') return new Promise(() => {});
      if (url === '/api/me/chart') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, chart: CHART }) });
      }
      if (url === '/api/relations') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              { relation_id: 'r1', nickname: '봄달이', mode: '일합', created_at: '2026-05-05T10:00:00Z' },
            ],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });
    await renderTodayPage();

    expect(await screen.findByTestId('loading-state')).toBeInTheDocument();
    const relationName = await screen.findByText('봄달이');
    await user.click(relationName);

    expect(mockPush).toHaveBeenCalledWith('/hapcard/r1?mode=%EC%9D%BC%ED%95%A9');
  });

  it('/api/today 401 UNAUTHORIZED → router.push("/start") 호출', async () => {
    setupRoutes({
      today: { ok: false, status: 401, body: { error: { code: 'UNAUTHORIZED', message: '' } } },
    });
    await renderTodayPage();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/start'));
  });

  it('/api/today 500 INTERNAL_ERROR → 에러 문구 없이 fallback 홈 렌더', async () => {
    setupRoutes({
      today: { ok: false, status: 500, body: { error: { code: 'INTERNAL_ERROR', message: '' } } },
    });
    await renderTodayPage();
    expect(await screen.findByText('오늘은 천천히 확인해요')).toBeInTheDocument();
    expect(screen.queryByText('잠시 문제가 생겼어요. 다시 시도해주세요.')).toBeNull();
    expect(screen.queryByText('AI가 많이 생각 중이에요. 잠시 후 다시 시도해주세요.')).toBeNull();
  });

  it('궁합 섹션 헤더 "다른 사람과의 사주" 렌더 (ADR-010 핵심 동선)', async () => {
    setupRoutes({});
    await renderTodayPage();
    expect(await screen.findByText('다른 사람과의 사주')).toBeInTheDocument();
  });

  it('/api/today 500 LLM_TIMEOUT → 에러 문구 없이 fallback 홈 렌더', async () => {
    setupRoutes({
      today: { ok: false, status: 500, body: { error: { code: 'LLM_TIMEOUT', message: '' } } },
    });
    await renderTodayPage();
    expect(await screen.findByText('오늘은 천천히 확인해요')).toBeInTheDocument();
    expect(screen.queryByText('AI가 많이 생각 중이에요. 잠시 후 다시 시도해주세요.')).toBeNull();
  });

  // F2.3: 인연 chip 인터랙티브 와이어링
  describe('F2.3: RelationChip wiring', () => {
    const CARD_WITH_RELATION: DailyHapCard = {
      ...CARD,
      relation_id: 'rel-current',
      relation_nickname: '민지',
      today_compat_score: 75,
    };

    const RELATIONS = [
      { relation_id: 'rel-current', nickname: '민지', mode: '일합', created_at: '2026-05-20' },
      { relation_id: 'rel-other', nickname: '지수', mode: '친구합', created_at: '2026-05-15' },
    ];

    it('card 에 relation_id 있을 때 RelationChip 마운트 (chip 별명 + chevron 아이콘)', async () => {
      setupRoutes({
        today: { ok: true, body: { ok: true, card: CARD_WITH_RELATION } },
        relations: { ok: true, body: { items: RELATIONS } },
      });
      await renderTodayPage();
      // chip 의 aria-label 로 hero RelationChip 만 정확히 찾음 (recent feed 내 별명과 분리)
      const chipButton = await screen.findByRole('button', {
        name: /오늘 민지과의 케미/,
      });
      expect(chipButton).toBeInTheDocument();
    });

    it('URL relation_id 가 있으면 /api/today query param 으로 전달', async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ relation_id: 'rel-other' }) as ReturnType<typeof useSearchParams>,
      );
      setupRoutes({
        today: {
          ok: true,
          body: {
            ok: true,
            card: { ...CARD_WITH_RELATION, relation_id: 'rel-other', relation_nickname: '지수' },
          },
        },
        relations: { ok: true, body: { items: RELATIONS } },
      });
      await renderTodayPage();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/today?relation_id=rel-other');
      });
    });

    it('인연 선택 시 URL relation_id 를 교체한다', async () => {
      const user = userEvent.setup();
      setupRoutes({
        today: { ok: true, body: { ok: true, card: CARD_WITH_RELATION } },
        relations: { ok: true, body: { items: RELATIONS } },
      });
      await renderTodayPage();

      const chipButton = await screen.findByRole('button', {
        name: /오늘 민지과의 케미/,
      });
      await user.click(chipButton);
      await user.click(await screen.findByRole('button', { name: /지수/ }));

      expect(mockReplace).toHaveBeenCalledWith('/?relation_id=rel-other');
    });

    it('card 에 relation_id 없을 때 RelationChip 미마운트', async () => {
      setupRoutes({
        today: { ok: true, body: { ok: true, card: CARD } },
        relations: { ok: true, body: { items: [] } },
      });
      await renderTodayPage();
      await screen.findByText('좋은 에너지가 흐르는 날');
      // chip 텍스트는 hero 의 별명 chip 패턴(`오늘 ...과의 케미`).
      // G-10 유도 블록 서브카피("그 사람과의 케미 흐름...")와 구분하기 위해 chip 전체 패턴으로 매칭
      expect(screen.queryByText(/오늘 .+과의 케미/)).toBeNull();
    });

    it('현재 URL relation_id 인연을 삭제하면 URL을 기본 홈으로 정리하고 today를 재조회한다', async () => {
      const user = userEvent.setup();
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ relation_id: 'rel-current' }) as ReturnType<typeof useSearchParams>,
      );
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url === '/api/today?relation_id=rel-current') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, card: CARD_WITH_RELATION }),
          });
        }
        if (url === '/api/me/chart') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, chart: CHART }),
          });
        }
        if (url === '/api/relations') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ items: RELATIONS }),
          });
        }
        if (url === '/api/relations/rel-current' && init?.method === 'DELETE') {
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
          queries: { retry: false, staleTime: 60_000 },
        },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await renderTodayPageWithQueryClient(queryClient);

      const deleteButtons = await screen.findAllByRole('button', { name: '삭제' });
      await user.click(deleteButtons[0]);
      expect(await screen.findByText('민지 인연을 삭제할까요?')).toBeInTheDocument();
      const confirmButtons = screen.getAllByRole('button', { name: '삭제' });
      await user.click(confirmButtons[confirmButtons.length - 1]);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/');
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['today'] });
    });
  });
});
