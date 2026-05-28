import { describe, it, expect, vi } from 'vitest';
import { buildDailyHap, type BuildDailyHapDeps } from '@/lib/today/builder';
import type { DailyHapCard } from '@/types/dailyHap';
import type { ChartCore } from '@/types/chart';

const CARD: DailyHapCard = {
  headline: '오늘은 집중력이 좋아요.',
  headline_reason: '木기운이 왕성해서 판단력이 예리합니다.',
  avoid_phrase: '충동적인 발언',
  avoid_phrase_reason: '火와 충돌할 수 있어요.',
  favorable_action: '집중이 필요한 작업 처리',
  favorable_action_reason: '木의 날카로움 활용.',
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
  five_elements_counts: { 목: 1, 화: 0, 토: 1, 금: 2, 수: 1 },
  gender_normalized: 'F',
};

function makeDeps(overrides: Partial<BuildDailyHapDeps> = {}): BuildDailyHapDeps {
  return {
    fetchTodayCache: vi.fn().mockResolvedValue(null),
    fetchYesterdayCache: vi.fn().mockResolvedValue(null),
    fetchUserChart: vi.fn().mockResolvedValue(SELF_CHART),
    fetchRelation: vi.fn().mockResolvedValue(null),
    fetchRelationChart: vi.fn().mockResolvedValue(null),
    callLlm: vi.fn().mockResolvedValue(CARD),
    saveCard: vi.fn().mockResolvedValue(undefined),
    today_date: '2026-05-28',
    ...overrides,
  };
}

describe('buildDailyHap — 캐시·실패·fallback (기존 회귀)', () => {
  it('cache hit → callLlm 미호출, 캐시 카드 반환', async () => {
    const cached = { ...CARD, headline: '캐시된 오늘 카드' };
    const deps = makeDeps({ fetchTodayCache: vi.fn().mockResolvedValue(cached) });
    const result = await buildDailyHap(deps);
    expect(result?.headline).toBe('캐시된 오늘 카드');
    expect(deps.callLlm).not.toHaveBeenCalled();
  });

  it('cache miss → callLlm 호출 1회 + saveCard 호출', async () => {
    const deps = makeDeps();
    const result = await buildDailyHap(deps);
    expect(deps.callLlm).toHaveBeenCalledOnce();
    expect(deps.saveCard).toHaveBeenCalledOnce();
    expect(result?.headline).toBe(CARD.headline);
  });

  it('llm 실패 + 어제 카드 존재 → reused_from_yesterday=true', async () => {
    const yesterday = { ...CARD, headline: '어제 카드', reused_from_yesterday: false };
    const deps = makeDeps({
      callLlm: vi.fn().mockRejectedValue(new Error('LLM error')),
      fetchYesterdayCache: vi.fn().mockResolvedValue(yesterday),
    });
    const result = await buildDailyHap(deps);
    expect(result?.reused_from_yesterday).toBe(true);
    expect(result?.headline).toBe('어제 카드');
  });

  it('llm 실패 + 어제 카드 없음 → 템플릿 카드 반환', async () => {
    const deps = makeDeps({ callLlm: vi.fn().mockRejectedValue(new Error('LLM error')) });
    const result = await buildDailyHap(deps);
    expect(result).not.toBeNull();
    expect(typeof result?.headline).toBe('string');
    expect(result?.avoid_phrase).toBeTruthy();
  });

  it('chart 없으면 템플릿 카드 반환 (callLlm 미호출)', async () => {
    const deps = makeDeps({ fetchUserChart: vi.fn().mockResolvedValue(null) });
    const result = await buildDailyHap(deps);
    expect(deps.callLlm).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result?.avoid_phrase).toBeTruthy();
  });
});

// G2 / Phase 3 C4 — 3축 (self + relation + today) 신규 경로
describe('buildDailyHap — 인연 종합 (G2)', () => {
  it('인연 0건 → callLlm 에 relation_chart=null 전달 + 결과 카드에 relation 필드 없음', async () => {
    const deps = makeDeps({
      fetchRelation: vi.fn().mockResolvedValue(null),
      fetchRelationChart: vi.fn().mockResolvedValue(null),
    });
    const result = await buildDailyHap(deps);
    expect(deps.callLlm).toHaveBeenCalledOnce();
    const llmArg = (deps.callLlm as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      self_chart: ChartCore;
      relation_chart: ChartCore | null;
      today_date: string;
    };
    expect(llmArg.self_chart).toBeDefined();
    expect(llmArg.relation_chart).toBeNull();
    expect(llmArg.today_date).toBe('2026-05-28');
    expect(result?.relation_id ?? null).toBeNull();
    expect(result?.relation_nickname ?? null).toBeNull();
    expect(result?.today_compat_score ?? null).toBeNull();
    expect(deps.fetchRelationChart).not.toHaveBeenCalled();
  });

  it('인연 존재 + chart 존재 → 3축 LLM + 카드에 relation_id/nickname/today_compat_score', async () => {
    const deps = makeDeps({
      fetchRelation: vi.fn().mockResolvedValue({
        id: 'rel-abc',
        nickname: '민지',
        mode: '오래합',
      }),
      fetchRelationChart: vi.fn().mockResolvedValue(REL_CHART),
    });
    const result = await buildDailyHap(deps);
    expect(deps.fetchRelationChart).toHaveBeenCalledWith('rel-abc');
    const llmArg = (deps.callLlm as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      self_chart: ChartCore;
      relation_chart: ChartCore | null;
      today_date: string;
    };
    expect(llmArg.relation_chart).toEqual(REL_CHART);
    expect(result?.relation_id).toBe('rel-abc');
    expect(result?.relation_nickname).toBe('민지');
    expect(typeof result?.today_compat_score).toBe('number');
    expect(result?.today_compat_score).toBeGreaterThanOrEqual(0);
    expect(result?.today_compat_score).toBeLessThanOrEqual(100);
  });

  it('인연 메타 존재 + chart 없음 (lazy gen 실패) → relation_chart=null, today_compat_score=null', async () => {
    const deps = makeDeps({
      fetchRelation: vi.fn().mockResolvedValue({
        id: 'rel-no-chart',
        nickname: '지수',
        mode: '친구합',
      }),
      fetchRelationChart: vi.fn().mockResolvedValue(null),
    });
    const result = await buildDailyHap(deps);
    const llmArg = (deps.callLlm as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      self_chart: ChartCore;
      relation_chart: ChartCore | null;
    };
    expect(llmArg.relation_chart).toBeNull();
    expect(result?.relation_id).toBe('rel-no-chart');
    expect(result?.relation_nickname).toBe('지수');
    // chart 없으면 today_compat_score 계산 불가 → null
    expect(result?.today_compat_score ?? null).toBeNull();
  });

  it('today_compat_score 는 결정형 — 동일 입력으로 두 번 호출하면 같은 값', async () => {
    const make = () => makeDeps({
      fetchRelation: vi.fn().mockResolvedValue({ id: 'rel-x', nickname: '하나', mode: '일합' }),
      fetchRelationChart: vi.fn().mockResolvedValue(REL_CHART),
    });
    const r1 = await buildDailyHap(make());
    const r2 = await buildDailyHap(make());
    expect(r1?.today_compat_score).toBe(r2?.today_compat_score);
  });
});

// Task 1 (Phase 3 후속) — 단계별 latency instrumentation + 실패 phase 캡처.
// route.ts 가 recordTrace 콜백을 받아 error_events 적재 / 메트릭 로깅에 사용.
describe('buildDailyHap — instrumentation trace (Task 1)', () => {
  it('성공 경로 — phases 에 todayCache/userChart/relation/llm/save 모두 기록 + failedPhase undefined', async () => {
    const recordTrace = vi.fn();
    const deps = makeDeps({ recordTrace });
    await buildDailyHap(deps);
    expect(recordTrace).toHaveBeenCalledOnce();
    const trace = recordTrace.mock.calls[0][0] as {
      phases: { name: string; durationMs: number }[];
      totalMs: number;
      failedPhase?: string;
      errorMessage?: string;
    };
    expect(trace.phases.map((p) => p.name)).toEqual([
      'todayCache',
      'userChart',
      'relation',
      'llm',
      'save',
    ]);
    expect(trace.failedPhase).toBeUndefined();
    expect(trace.totalMs).toBeGreaterThanOrEqual(0);
    trace.phases.forEach((p) => expect(p.durationMs).toBeGreaterThanOrEqual(0));
  });

  it('chart null → failedPhase=userChart + errorMessage=chart_null', async () => {
    const recordTrace = vi.fn();
    const deps = makeDeps({
      fetchUserChart: vi.fn().mockResolvedValue(null),
      recordTrace,
    });
    await buildDailyHap(deps);
    const trace = recordTrace.mock.calls[0][0] as {
      failedPhase?: string;
      errorMessage?: string;
    };
    expect(trace.failedPhase).toBe('userChart');
    expect(trace.errorMessage).toBe('chart_null');
  });

  it('LLM throw → failedPhase=llm + errorMessage 캡처 + yesterdayCache phase 추가', async () => {
    const recordTrace = vi.fn();
    const deps = makeDeps({
      callLlm: vi.fn().mockRejectedValue(new Error('OpenAI timeout')),
      recordTrace,
    });
    await buildDailyHap(deps);
    const trace = recordTrace.mock.calls[0][0] as {
      phases: { name: string }[];
      failedPhase?: string;
      errorMessage?: string;
    };
    expect(trace.failedPhase).toBe('llm');
    expect(trace.errorMessage).toContain('OpenAI timeout');
    expect(trace.phases.map((p) => p.name)).toContain('yesterdayCache');
    // failedPhase 는 LLM 시점 캡처 후 yesterdayCache 단계가 덮어쓰지 않아야 함.
    expect(trace.failedPhase).not.toBe('yesterdayCache');
  });

  it('cache hit → phases 에 todayCache 만 + failedPhase undefined', async () => {
    const recordTrace = vi.fn();
    const cached = { ...CARD, headline: '캐시' };
    const deps = makeDeps({
      fetchTodayCache: vi.fn().mockResolvedValue(cached),
      recordTrace,
    });
    await buildDailyHap(deps);
    const trace = recordTrace.mock.calls[0][0] as {
      phases: { name: string }[];
      failedPhase?: string;
    };
    expect(trace.phases.map((p) => p.name)).toEqual(['todayCache']);
    expect(trace.failedPhase).toBeUndefined();
  });

  it('recordTrace 미주입 시 정상 동작 (옵셔널 콜백)', async () => {
    const deps = makeDeps();
    // recordTrace 미주입 — TypeScript 옵셔널 필드.
    const result = await buildDailyHap(deps);
    expect(result?.headline).toBe(CARD.headline);
  });
});
