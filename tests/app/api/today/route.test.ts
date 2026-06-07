import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/today/builder');
vi.mock('@/lib/today/relation-picker');
vi.mock('@/lib/today/lazy-relation-chart');
vi.mock('@/lib/llm/clients');
vi.mock('@/lib/today/openai');
vi.mock('@/lib/chart/queries');
vi.mock('@/lib/supabase/service-role');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { buildDailyHap } from '@/lib/today/builder';
import { pickTodayRelation } from '@/lib/today/relation-picker';
import { ensureRelationChart } from '@/lib/today/lazy-relation-chart';
import {
  fetchLatestUserChartForVersion,
} from '@/lib/chart/queries';
import { createOpenAiClient } from '@/lib/llm/clients';
import { selectLlmModel } from '@/lib/llm/model-router';
import { callDailyHapLlm } from '@/lib/today/openai';
import { buildSourcePacketHash } from '@/lib/today/cache-key';
import { withYunseAtDate } from '@/lib/chart/yunse-at-date';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
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

const TODAY_RELATION_PROMPT_VERSION = 'today_with_relation:v0.1';
const TODAY_TARGET_DATE = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const USER_BIRTH_ROW = {
  birth_date: '1990-01-01',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'unknown',
  birth_time: null,
  gender: 'M',
} as const;

const RELATION_BIRTH_ROW = {
  ...USER_BIRTH_ROW,
  birth_date: '1992-02-03',
  gender: 'F',
} as const;

// F1.2: 캡처 가능한 단일 upsert mock — 여러 from() 호출에서도 동일 인스턴스
const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

function makeBirthQuery(row: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
      }),
    }),
  };
}

function makeDailyHapQuery(
  row: unknown | null,
  error: { message: string } | null = null,
) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error }),
    upsert: upsertMock,
  };
}

function makeClient(userId: string | null = 'user-001') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    // route 내부에서 직접 daily_haps select 호출(builder 의 fetch*Cache 클로저 안에서)을 위한 가벼운 stub
    from: vi.fn((table: string) => {
      if (table === 'users') return makeBirthQuery(USER_BIRTH_ROW);
      if (table === 'relations') return makeBirthQuery(RELATION_BIRTH_ROW);
      return makeDailyHapQuery(null);
    }),
  };
}

function makeClientWithDailyHapRow(row: unknown, userId = 'user-001') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') return makeBirthQuery(USER_BIRTH_ROW);
      if (table === 'relations') return makeBirthQuery(RELATION_BIRTH_ROW);
      return makeDailyHapQuery(row);
    }),
  };
}

function makeClientWithDailyHapError(error: { message: string }, userId = 'user-001') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') return makeBirthQuery(USER_BIRTH_ROW);
      if (table === 'relations') return makeBirthQuery(RELATION_BIRTH_ROW);
      return makeDailyHapQuery(null, error);
    }),
  };
}

function makeClientWithBirthRows(userId = 'user-001') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') return makeBirthQuery(USER_BIRTH_ROW);
      if (table === 'relations') return makeBirthQuery(RELATION_BIRTH_ROW);
      return makeDailyHapQuery(null);
    }),
  };
}

function makeRequest(url = 'http://localhost/api/today'): Request {
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  upsertMock.mockClear();
  vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn() } as never);
  vi.mocked(createOpenAiClient).mockReturnValue({} as never);
  vi.mocked(callDailyHapLlm).mockResolvedValue(CARD);
  vi.mocked(buildDailyHap).mockResolvedValue(CARD);
  vi.mocked(pickTodayRelation).mockResolvedValue(null);
  vi.mocked(fetchLatestUserChartForVersion).mockResolvedValue({
    data: { chart_core: SELF_CHART, chart_hash: 'h1' },
    error: null,
  } as never);
  // F3.2: ensureRelationChart 가 lazy compute 까지 포함한 단일 진입점
  vi.mocked(ensureRelationChart).mockResolvedValue(REL_CHART);
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
    expect(body.card).toBeNull();
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

  it('buildDailyHap throw 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(buildDailyHap).mockRejectedValue(
      new Error('DB down birth_date=1995-06-15 birth_time=10:30:00 gender=F'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    const calls = JSON.stringify(consoleSpy.mock.calls);
    expect(calls).not.toContain('1995-06-15');
    expect(calls).not.toContain('10:30:00');
    expect(calls).not.toContain('gender=F');
    expect(calls).toContain('birth_date=[redacted]');
    expect(calls).toContain('birth_time=[redacted]');
    expect(calls).toContain('gender=[redacted]');
  });

  it('OpenAI client 생성은 builder LLM 단계까지 지연한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    await GET(makeRequest());
    expect(createOpenAiClient).not.toHaveBeenCalled();
  });

  it('builder 가 callLlm 을 호출할 때 OpenAI client 를 생성한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(buildDailyHap).mockImplementation(async (deps) =>
      deps.callLlm({
        self_chart: SELF_CHART,
        relation_chart: null,
        today_date: '2026-05-28',
      }),
    );

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(createOpenAiClient).toHaveBeenCalledTimes(1);
    expect(callDailyHapLlm).toHaveBeenCalledWith(
      {
        self_chart: SELF_CHART,
        relation_chart: null,
        today_date: '2026-05-28',
      },
      expect.anything(),
      expect.anything(),
      'user-001',
      expect.objectContaining({ costClient: expect.anything() }),
    );
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

  it('어제 fallback 캐시는 현재 relation_id 와 다르면 무시한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClientWithDailyHapRow({
        headline: '이전 인연용 어제 문장',
        headline_reason: '이 문장이 새 인연에 섞이면 안 돼요.',
        avoid_phrase: 'old',
        avoid_phrase_reason: 'old reason',
        favorable_action: 'old action',
        favorable_action_reason: 'old action reason',
        reused_from_yesterday: false,
        primary_relation_id: 'rel-old',
        relation_nickname: '이전인연',
        today_compat_score: 44,
      }) as never,
    );
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-new',
      nickname: '새인연',
      mode: '오래합',
    });
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      const yesterday = await deps.fetchYesterdayCache();
      return yesterday ?? CARD;
    });

    const res = await GET(makeRequest('http://localhost/api/today?relation_id=rel-new'));
    const body = await res.json();

    expect(body.card.headline).toBe(CARD.headline);
    expect(body.card.headline).not.toBe('이전 인연용 어제 문장');
    expect(body.card.relation_id).toBe('rel-new');
    expect(body.card.relation_nickname).toBe('새인연');
  });

  it('오늘 캐시는 relation_id가 같아도 source_packet_hash가 다르면 무시한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClientWithDailyHapRow({
        headline: '구형 source packet 본문',
        headline_reason: '모델이나 프롬프트가 바뀐 본문이 섞이면 안 돼요.',
        avoid_phrase: 'stale',
        avoid_phrase_reason: 'stale reason',
        favorable_action: 'stale action',
        favorable_action_reason: 'stale action reason',
        reused_from_yesterday: false,
        primary_relation_id: 'rel-current',
        relation_nickname: '현재인연',
        today_compat_score: 44,
        source_packet_hash: 'stale-source-packet-hash',
        llm_model: selectLlmModel('today'),
      }) as never,
    );
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-current',
      nickname: '현재인연',
      mode: '오래합',
    });
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      const cached = await deps.fetchTodayCache();
      return cached ?? CARD;
    });

    const res = await GET(makeRequest('http://localhost/api/today?relation_id=rel-current'));
    const body = await res.json();

    expect(body.card.headline).toBe(CARD.headline);
    expect(body.card.headline).not.toBe('구형 source packet 본문');
    expect(body.card.relation_id).toBe('rel-current');
    expect(body.card.relation_nickname).toBe('현재인연');
  });

  it('오늘 캐시 조회 오류는 cache miss 로 위장해 생성 경로로 진행하지 않는다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClientWithDailyHapError({ message: 'daily_haps lookup failed' }) as never,
    );
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      await deps.fetchTodayCache();
      return CARD;
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await GET(makeRequest('http://localhost/api/today?relation_id=rel-current'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    consoleSpy.mockRestore();
  });

  it('오늘 캐시는 relation_id와 source_packet_hash가 모두 같으면 재사용한다', async () => {
    const datedSelfChart = withYunseAtDate(SELF_CHART, USER_BIRTH_ROW, TODAY_TARGET_DATE);
    const datedRelationChart = withYunseAtDate(
      REL_CHART,
      RELATION_BIRTH_ROW,
      TODAY_TARGET_DATE,
    );
    const sourcePacketHash = buildSourcePacketHash({
      self_chart: datedSelfChart,
      relation_chart: datedRelationChart,
      target_date: TODAY_TARGET_DATE,
      prompt_version: TODAY_RELATION_PROMPT_VERSION,
      model_id: selectLlmModel('today'),
    });
    vi.mocked(createServerClient).mockResolvedValue(
      makeClientWithDailyHapRow({
        headline: '검증된 현재 source packet 본문',
        headline_reason: '같은 relation, 날짜, 모델, 프롬프트, 차트 해시만 재사용해요.',
        avoid_phrase: 'stale 금지',
        avoid_phrase_reason: 'source packet이 같아서 정상 캐시입니다.',
        favorable_action: '짧게 확인하기',
        favorable_action_reason: '캐시가 과도하게 버려지지 않아야 해요.',
        reused_from_yesterday: false,
        primary_relation_id: 'rel-current',
        relation_nickname: '현재인연',
        today_compat_score: 58,
        source_packet_hash: sourcePacketHash,
        llm_model: selectLlmModel('today'),
      }) as never,
    );
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-current',
      nickname: '현재인연',
      mode: '오래합',
    });
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      const cached = await deps.fetchTodayCache();
      return cached ?? CARD;
    });

    const res = await GET(makeRequest('http://localhost/api/today?relation_id=rel-current'));
    const body = await res.json();

    expect(body.card.headline).toBe('검증된 현재 source packet 본문');
    expect(body.card.relation_id).toBe('rel-current');
    expect(body.card.relation_nickname).toBe('현재인연');
  });

  it('relation 있지만 chart 없음 → relation_id/nickname 채워지고 today_compat_score=null', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-no-chart',
      nickname: '지수',
      mode: '친구합',
    });
    vi.mocked(ensureRelationChart).mockResolvedValue(null);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.card.relation_id).toBe('rel-no-chart');
    expect(body.card.relation_nickname).toBe('지수');
    expect(body.card.today_compat_score ?? null).toBeNull();
  });

  it('relation chart 조회 오류는 fallback card 로 위장하지 않고 500 으로 반환한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-db-error',
      nickname: '민지',
      mode: '일합',
    });
    vi.mocked(ensureRelationChart).mockRejectedValueOnce(
      new Error('relation_charts failed birth_date=1995-06-15 birth_time=10:30:00 gender=F'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await GET(makeRequest('http://localhost/api/today?relation_id=rel-db-error'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('1995-06-15');
    expect(JSON.stringify(body)).not.toContain('10:30:00');
    expect(JSON.stringify(body)).not.toContain('gender=F');
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).not.toContain('1995-06-15');
    expect(logged).not.toContain('10:30:00');
    expect(logged).not.toContain('gender=F');
    expect(logged).toContain('birth_date=[redacted]');
    expect(logged).toContain('birth_time=[redacted]');
    expect(logged).toContain('gender=[redacted]');
    consoleSpy.mockRestore();
  });

  it('저장된 chart yunse가 과거여도 target_date 기준 yunse로 재투영해 builder에 전달한다', async () => {
    const staleDate = '2020-01-01';
    const staleSelf = {
      ...SELF_CHART,
      yunse: {
        ...SELF_CHART.yunse,
        iliun: { today_pillar: '갑자', today_date: staleDate },
      },
    };
    const staleRelation = {
      ...REL_CHART,
      yunse: {
        ...REL_CHART.yunse,
        iliun: { today_pillar: '갑자', today_date: staleDate },
      },
    };
    const capturedCharts: {
      self: ChartCore | null;
      relation: ChartCore | null;
    } = {
      self: null,
      relation: null,
    };
    vi.mocked(createServerClient).mockResolvedValue(makeClientWithBirthRows() as never);
    vi.mocked(fetchLatestUserChartForVersion).mockResolvedValue({
      data: { chart_core: staleSelf, chart_hash: 'stale-self' },
      error: null,
    } as never);
    vi.mocked(ensureRelationChart).mockResolvedValue(staleRelation);
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-date',
      nickname: '날짜인연',
      mode: '일합',
    });
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      capturedCharts.self = await deps.fetchUserChart();
      const relation = await deps.fetchRelation();
      capturedCharts.relation = relation
        ? await deps.fetchRelationChart(relation.id)
        : null;
      return CARD;
    });

    const res = await GET(makeRequest('http://localhost/api/today?relation_id=rel-date'));

    expect(res.status).toBe(200);
    expect(capturedCharts.self?.yunse.iliun.today_date).toBe(TODAY_TARGET_DATE);
    expect(capturedCharts.relation?.yunse.iliun.today_date).toBe(TODAY_TARGET_DATE);
  });

  it('fallback card 는 relation 메타를 유지하되 today_compat_score 를 붙이지 않는다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-fallback',
      nickname: '민지',
      mode: '일합',
    });
    vi.mocked(buildDailyHap).mockResolvedValue({
      ...CARD,
      headline: '오늘 메시지를 준비하지 못했어요.',
      is_fallback: true,
    } as DailyHapCard & { is_fallback: true });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.card.is_fallback).toBe(true);
    expect(body.card.relation_id).toBe('rel-fallback');
    expect(body.card.relation_nickname).toBe('민지');
    expect(body.card.today_compat_score ?? null).toBeNull();
  });
});

// G2 / Phase 3 C9 — feature flag rollback (NEXT_PUBLIC_TODAY_WITH_RELATION=false)
describe('GET /api/today (feature flag rollback)', () => {
  const originalFlag = process.env.NEXT_PUBLIC_TODAY_WITH_RELATION;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_TODAY_WITH_RELATION = 'false';
  });
  afterAll(() => {
    if (originalFlag === undefined) delete process.env.NEXT_PUBLIC_TODAY_WITH_RELATION;
    else process.env.NEXT_PUBLIC_TODAY_WITH_RELATION = originalFlag;
  });

  it('flag=false → pickTodayRelation 미호출 + relation 필드 없음 (기존 단독축 today 그대로)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    // pickTodayRelation 이 호출되면 안 됨 (flag off)
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-should-not-appear',
      nickname: '안나옴',
      mode: '일합',
    });

    const res = await GET(makeRequest());
    expect(pickTodayRelation).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.card.relation_id ?? null).toBeNull();
    expect(body.card.relation_nickname ?? null).toBeNull();
    expect(body.card.today_compat_score ?? null).toBeNull();
  });
});

// G2 / Phase 3 F1.3 — rowToCard 신규 3 필드 매핑
describe('rowToCard (F1.3)', () => {
  // dynamic import 로 mock 통과
  it('primary_relation_id → relation_id 매핑, 나머지 2 필드 그대로', async () => {
    const { rowToCard } = await import('@/app/api/today/route');
    const card = rowToCard({
      headline: 'h',
      headline_reason: 'hr',
      avoid_phrase: 'a',
      avoid_phrase_reason: 'ar',
      favorable_action: 'f',
      favorable_action_reason: 'fr',
      reused_from_yesterday: false,
      primary_relation_id: 'rel-x',
      relation_nickname: '민지',
      today_compat_score: 75,
    });
    expect(card.relation_id).toBe('rel-x');
    expect(card.relation_nickname).toBe('민지');
    expect(card.today_compat_score).toBe(75);
  });

  it('legacy row(신규 컬럼 undefined) → relation 필드 모두 null', async () => {
    const { rowToCard } = await import('@/app/api/today/route');
    const card = rowToCard({
      headline: 'h',
      headline_reason: 'hr',
      avoid_phrase: 'a',
      avoid_phrase_reason: 'ar',
      favorable_action: 'f',
      favorable_action_reason: 'fr',
      reused_from_yesterday: false,
    });
    expect(card.relation_id).toBeNull();
    expect(card.relation_nickname).toBeNull();
    expect(card.today_compat_score).toBeNull();
  });
});

// G2 / Phase 3 F1.2 — saveCard 신규 컬럼 영속화
describe('GET /api/today (F1.2 saveCard 신규 컬럼 영속화)', () => {
  it('relation 존재 시 → upsert payload에 primary_relation_id, relation_nickname, today_compat_score 포함', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-abc',
      nickname: '민지',
      mode: '일합',
    });

    // builder 가 실제로 saveCard 를 호출하도록 mockImplementation 으로 차단해제
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      // saveCard 가 받는 card 는 applyRelationMeta 결과 — 3 신규 필드 포함
      const finalCard = {
        ...CARD,
        relation_id: 'rel-abc',
        relation_nickname: '민지',
        today_compat_score: 75,
      };
      await deps.saveCard(finalCard);
      return finalCard;
    });

    await GET(makeRequest());

    // upsert 호출 args 검증 — daily_haps.upsert 단일 호출 기대
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const payload = upsertMock.mock.calls[0][0];
    expect(payload.primary_relation_id).toBe('rel-abc');
    expect(payload.relation_nickname).toBe('민지');
    expect(payload.today_compat_score).toBe(75);
  });

  it('relation 미존재(인연 0건) → upsert payload의 신규 3컬럼 모두 null', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(pickTodayRelation).mockResolvedValue(null);

    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      // 인연 미존재 시 applyRelationMeta 가 신규 필드 미주입 (undefined)
      await deps.saveCard({ ...CARD });
      return CARD;
    });

    await GET(makeRequest());

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const payload = upsertMock.mock.calls[0][0];
    expect(payload.primary_relation_id ?? null).toBeNull();
    expect(payload.relation_nickname ?? null).toBeNull();
    expect(payload.today_compat_score ?? null).toBeNull();
  });

  it('relation 존재 + today_compat_score=null (chart 미존재) → score만 null, id/nickname은 채워짐', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(pickTodayRelation).mockResolvedValue({
      id: 'rel-no-chart',
      nickname: '지수',
      mode: '친구합',
    });

    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      const finalCard = {
        ...CARD,
        relation_id: 'rel-no-chart',
        relation_nickname: '지수',
        today_compat_score: null,
      };
      await deps.saveCard(finalCard);
      return finalCard;
    });

    await GET(makeRequest());

    const payload = upsertMock.mock.calls[0][0];
    expect(payload.primary_relation_id).toBe('rel-no-chart');
    expect(payload.relation_nickname).toBe('지수');
    expect(payload.today_compat_score).toBeNull();
  });

  it('daily_haps upsert 오류는 정상 카드로 위장하지 않고 save 실패로 throw 한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    upsertMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'daily_haps upsert failed' },
    });
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      await expect(deps.saveCard(CARD)).rejects.toThrow(
        'TODAY_CACHE_SAVE_FAILED: daily_haps upsert failed',
      );
      return { ...CARD, is_fallback: true };
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.card.is_fallback).toBe(true);
  });
});

// Task 1 (Phase 3 후속) — instrumentation trace → error_events 적재
describe('GET /api/today (Task 1 instrumentation trace)', () => {
  const errorEventsInsert = vi.fn();

  function makeTracingClient(userId = 'user-001') {
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: userId } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'error_events') {
          return {
            insert: errorEventsInsert.mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          upsert: upsertMock,
        };
      }),
    };
  }

  beforeEach(() => {
    errorEventsInsert.mockReset();
  });

  it('buildDailyHap deps 에 recordTrace 콜백 주입', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeTracingClient() as never);
    await GET(makeRequest());
    const depsArg = vi.mocked(buildDailyHap).mock.calls[0][0];
    expect(typeof depsArg.recordTrace).toBe('function');
  });

  it('failedPhase=llm + LLM_TIMEOUT: prefix → error_events.error_code=LLM_TIMEOUT', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeTracingClient() as never);
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      await deps.recordTrace?.({
        phases: [
          { name: 'todayCache', durationMs: 50 },
          { name: 'userChart', durationMs: 100 },
          { name: 'relation', durationMs: 30 },
          { name: 'relationChart', durationMs: 14000 },
          { name: 'llm', durationMs: 200 },
        ],
        totalMs: 14400,
        failedPhase: 'llm',
        errorMessage: 'LLM_TIMEOUT: Request was aborted',
      });
      return CARD;
    });

    await GET(makeRequest());

    expect(errorEventsInsert).toHaveBeenCalledTimes(1);
    const insertArg = errorEventsInsert.mock.calls[0][0];
    expect(insertArg.error_code).toBe('LLM_TIMEOUT');
    expect(insertArg.user_id).toBe('user-001');
    expect(insertArg.context.phase).toBe('llm');
    expect(insertArg.context.total_ms).toBe(14400);
    expect(insertArg.context.source).toBe('today.recordTrace');
    expect(insertArg.stack).toContain('LLM_TIMEOUT');
  });

  it('LLM_PARSE_FAIL: prefix → error_code=LLM_PARSE_FAIL', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeTracingClient() as never);
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      await deps.recordTrace?.({
        phases: [{ name: 'llm', durationMs: 8000 }],
        totalMs: 8500,
        failedPhase: 'llm',
        errorMessage: 'LLM_PARSE_FAIL: Unexpected token in JSON',
      });
      return CARD;
    });
    await GET(makeRequest());
    expect(errorEventsInsert).toHaveBeenCalledTimes(1);
    expect(errorEventsInsert.mock.calls[0][0].error_code).toBe('LLM_PARSE_FAIL');
  });

  it('failedPhase=userChart + chart_null → error_code=USER_CHART_NOT_FOUND', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeTracingClient() as never);
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      await deps.recordTrace?.({
        phases: [
          { name: 'todayCache', durationMs: 50 },
          { name: 'userChart', durationMs: 80 },
        ],
        totalMs: 130,
        failedPhase: 'userChart',
        errorMessage: 'chart_null',
      });
      return CARD;
    });
    await GET(makeRequest());
    expect(errorEventsInsert).toHaveBeenCalledTimes(1);
    expect(errorEventsInsert.mock.calls[0][0].error_code).toBe('USER_CHART_NOT_FOUND');
  });

  it('성공 trace (failedPhase undefined) → error_events INSERT 미호출', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeTracingClient() as never);
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      await deps.recordTrace?.({
        phases: [
          { name: 'todayCache', durationMs: 50 },
          { name: 'userChart', durationMs: 100 },
          { name: 'relation', durationMs: 30 },
          { name: 'llm', durationMs: 3000 },
          { name: 'save', durationMs: 80 },
        ],
        totalMs: 3260,
      });
      return CARD;
    });
    await GET(makeRequest());
    expect(errorEventsInsert).not.toHaveBeenCalled();
  });

  it('failedPhase=relationChart + 메시지 패턴 미스 → error_code=TODAY_BUILD_FAIL (기본값)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeTracingClient() as never);
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      await deps.recordTrace?.({
        phases: [{ name: 'relationChart', durationMs: 15000 }],
        totalMs: 15100,
        failedPhase: 'relationChart',
        errorMessage: 'Some opaque infra error',
      });
      return CARD;
    });
    await GET(makeRequest());
    expect(errorEventsInsert).toHaveBeenCalledTimes(1);
    expect(errorEventsInsert.mock.calls[0][0].error_code).toBe('TODAY_BUILD_FAIL');
  });

  it('error_events.stack 에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeTracingClient() as never);
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      await deps.recordTrace?.({
        phases: [{ name: 'llm', durationMs: 8000 }],
        totalMs: 8500,
        failedPhase: 'llm',
        errorMessage: 'LLM failed birth_date=1995-06-15 birth_time=10:30:00 gender=F',
      });
      return CARD;
    });

    await GET(makeRequest());

    const stack = errorEventsInsert.mock.calls[0][0].stack;
    expect(stack).not.toContain('1995-06-15');
    expect(stack).not.toContain('10:30:00');
    expect(stack).not.toContain('gender=F');
    expect(stack).toContain('birth_date=[redacted]');
    expect(stack).toContain('birth_time=[redacted]');
    expect(stack).toContain('gender=[redacted]');
  });

  it('error_events insert 실패 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    errorEventsInsert.mockRejectedValueOnce(
      new Error('insert failed birth_date=1995-06-15 birth_time=10:30:00 gender=F'),
    );
    vi.mocked(createServerClient).mockResolvedValue(makeTracingClient() as never);
    vi.mocked(buildDailyHap).mockImplementation(async (deps) => {
      await deps.recordTrace?.({
        phases: [{ name: 'llm', durationMs: 8000 }],
        totalMs: 8500,
        failedPhase: 'llm',
        errorMessage: 'LLM_TIMEOUT: Request was aborted',
      });
      return CARD;
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await GET(makeRequest());

    const calls = JSON.stringify(consoleSpy.mock.calls);
    expect(calls).not.toContain('1995-06-15');
    expect(calls).not.toContain('10:30:00');
    expect(calls).not.toContain('gender=F');
    expect(calls).toContain('birth_date=[redacted]');
    expect(calls).toContain('birth_time=[redacted]');
    expect(calls).toContain('gender=[redacted]');
  });
});
