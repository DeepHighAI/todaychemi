// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { renderWithProviders } from '../../utils/render-with-providers';
import type { DailyHapCard } from '@/types/dailyHap';
import type { ChartCore } from '@/types/chart';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

const mockPush = vi.fn();

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  vi.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
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
    if (url === '/api/today') {
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
  const { default: TodayPage } = await import('@/app/(app)/page');
  return renderWithProviders(<TodayPage />);
}

describe('TodayPage (composition)', () => {
  it('TodayAppBar 제목 "오늘의 사이" 렌더', async () => {
    setupRoutes({});
    await renderTodayPage();
    expect(await screen.findByRole('heading', { level: 1, name: '오늘의 사이' })).toBeInTheDocument();
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

  it('today fetch 실패 시 ErrorCard 렌더', async () => {
    setupRoutes({
      today: { ok: false, status: 500, body: { ok: false, code: 'INTERNAL_ERROR' } },
    });
    await renderTodayPage();
    await waitFor(() => expect(screen.getByTestId('error-card')).toBeInTheDocument());
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

  it('/api/today 401 UNAUTHORIZED → router.push("/login") 호출', async () => {
    setupRoutes({
      today: { ok: false, status: 401, body: { error: { code: 'UNAUTHORIZED', message: '' } } },
    });
    await renderTodayPage();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
  });

  it('/api/today 500 INTERNAL_ERROR → "잠시 문제가 생겼어요" 렌더 (LLM_TIMEOUT 아님)', async () => {
    setupRoutes({
      today: { ok: false, status: 500, body: { error: { code: 'INTERNAL_ERROR', message: '' } } },
    });
    await renderTodayPage();
    expect(await screen.findByText('잠시 문제가 생겼어요. 다시 시도해주세요.')).toBeInTheDocument();
    expect(screen.queryByText('AI가 많이 생각 중이에요. 잠시 후 다시 시도해주세요.')).toBeNull();
  });

  it('궁합 섹션 헤더 "다른 사람과의 사주" 렌더 (ADR-010 핵심 동선)', async () => {
    setupRoutes({});
    await renderTodayPage();
    expect(await screen.findByText('다른 사람과의 사주')).toBeInTheDocument();
  });

  it('/api/today 500 LLM_TIMEOUT → "AI가 많이 생각 중이에요" 렌더', async () => {
    setupRoutes({
      today: { ok: false, status: 500, body: { error: { code: 'LLM_TIMEOUT', message: '' } } },
    });
    await renderTodayPage();
    expect(await screen.findByText('AI가 많이 생각 중이에요. 잠시 후 다시 시도해주세요.')).toBeInTheDocument();
  });
});
