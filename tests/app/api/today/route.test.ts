import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/today/builder');
vi.mock('@/lib/today/relation-picker');
vi.mock('@/lib/llm/clients');
vi.mock('@/lib/chart/queries');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { buildDailyHap } from '@/lib/today/builder';
import { pickTodayRelation } from '@/lib/today/relation-picker';
import {
  fetchLatestUserChartForVersion,
  fetchLatestRelationChartForVersion,
} from '@/lib/chart/queries';
import { GET } from '@/app/api/today/route';
import type { DailyHapCard } from '@/types/dailyHap';
import type { ChartCore } from '@/types/chart';

const CARD: DailyHapCard = {
  headline: '오늘은 집중력이 좋아요.',
  headline_reason: '木기운.',
  avoid_phrase: '충동 발언',
  avoid_phrase_reason: '火 충돌.',
  favorable_action: '집중 작업',
  favorable_action_reason: '木 활용.',
  reused_from_yesterday: false,
};

const SELF_CHART: ChartCore = {
  year_pillar: '甲子',
  month_pillar: '乙丑',
  day_pillar: '丙寅',
  hour_pillar: null,
  day_master_element: '화',
  five_elements_counts: { 목: 2, 화: 1, 토: 0, 금: 0, 수: 1 },
  gender_normalized: 'M',
  yunse: {
    daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 },
    seyun: { current_pillar: '병오', current_year: 2026 },
    wolun: { current_pillar: '계사', current_month: '2026-05' },
    iliun: { today_pillar: '갑자', today_date: '2026-05-28' },
  },
};

const REL_CHART: ChartCore = {
  ...SELF_CHART,
  year_pillar: '己卯',
  month_pillar: '庚辰',
  day_pillar: '辛巳',
  day_master_element: '금',
};

function makeClient(userId: string | null = 'user-001') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    // route 내부에서 직접 daily_haps select 호출(builder 의 fetch*Cache 클로저 안에서)을 위한 가벼운 stub
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  };
}

function makeRequest(url = 'http://localhost/api/today'): Request {
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildDailyHap).mockResolvedValue(CARD);
  vi.mocked(pickTodayRelation).mockResolvedValue(null);
  vi.mocked(fetchLatestUserChartForVersion).mockResolvedValue({
    data: { chart_core: SELF_CHART, chart_hash: 'h1' },
    error: null,
  } as never);
  vi.mocked(fetchLatestRelationChartForVersion).mockResolvedValue({
    data: { chart_core: REL_CHART, chart_hash: 'rh1' },
    error: null,
  } as never);
});

describe('GET /api/today (기본 회귀)', () => {
  it('200 → buildDailyHap 반환 카드', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.card.headline).toBe(CARD.headline);
  });

  it('200 → card=null 인 경우 (3순위 폴백 — 섹션 숨김)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(buildDailyHap).mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // C7: card=null 인 경우에도 applyRelationMetaToResponse 가 빈 객체 반환
    // (실제로는 buildDailyHap 가 null 반환 케이스 자체가 매우 드뭄)
    expect(body.card).toBeDefined();
  });

  it('401 → UNAUTHORIZED (미인증)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient(null) as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(vi.mocked(buildDailyHap)).not.toHaveBeenCalled();
  });

  it('500 → INTERNAL_ERROR (buildDailyHap throw)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(buildDailyHap).mockRejectedValue(new Error('DB down'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});

// G2 / Phase 3 C7 — 인연 종합 경로
describe('GET /api/today (G2 인연 종합)', () => {
  it('relation 0건 → 응답 카드에 relation 필드 없음 (기존 동작 유지)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(pickTodayRelation).mockResolvedValue(null);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.card.relation_id ?? null).toBeNull();
    expect(body.card.relation_nickname ?? null).toBeNull();
    expect(body.card.today_compat_score ?? null).toBeNull();
  });

  it('relation 자동 선택 → 응답 카드에 relation_id, nickname, today_compat_score 주입', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-auto',
      nickname: '민지',
      mode: '일합',
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.card.relation_id).toBe('rel-auto');
    expect(body.card.relation_nickname).toBe('민지');
    expect(typeof body.card.today_compat_score).toBe('number');
    expect(body.card.today_compat_score).toBeGreaterThanOrEqual(0);
    expect(body.card.today_compat_score).toBeLessThanOrEqual(100);
  });

  it('relation_id query param 전달 → pickTodayRelation 에 preferredRelationId 그대로 전달', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-pref',
      nickname: '하나',
      mode: '오래합',
    });
    await GET(makeRequest('http://localhost/api/today?relation_id=rel-pref'));
    expect(pickTodayRelation).toHaveBeenCalledWith(
      expect.anything(),
      'user-001',
      'rel-pref',
    );
  });

  it('relation 있지만 chart 없음 → relation_id/nickname 채워지고 today_compat_score=null', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-no-chart',
      nickname: '지수',
      mode: '친구합',
    });
    vi.mocked(fetchLatestRelationChartForVersion).mockResolvedValue({
      data: null,
      error: null,
    } as never);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.card.relation_id).toBe('rel-no-chart');
    expect(body.card.relation_nickname).toBe('지수');
    expect(body.card.today_compat_score ?? null).toBeNull();
  });
});
