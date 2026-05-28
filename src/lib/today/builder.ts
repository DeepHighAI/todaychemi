import type { DailyHapCard, DailyHapResult } from '@/types/dailyHap';
import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';
import { computeTodayCompatScore } from '@/lib/scoring/today';

export interface TodayRelationMeta {
  id: string;
  nickname: string;
  mode: Mode;
}

export interface TodayLlmInput {
  self_chart: ChartCore;
  relation_chart: ChartCore | null;
  today_date: string;
}

// Task 1 (Phase 3 후속) — 단계별 latency + 실패 phase 캡처용 trace.
// route.ts 가 recordTrace 콜백으로 error_events 적재 / 메트릭 로깅에 사용.
export interface TodayTracePhase {
  name: string;
  durationMs: number;
}
export interface TodayTrace {
  phases: TodayTracePhase[];
  totalMs: number;
  failedPhase?: string;
  errorMessage?: string;
}

export interface BuildDailyHapDeps {
  fetchTodayCache: () => Promise<DailyHapCard | null>;
  fetchYesterdayCache: () => Promise<DailyHapCard | null>;
  fetchUserChart: () => Promise<ChartCore | null>;
  // G2 / Phase 3 C4 — 인연 종합. 인연 0건 사용자는 fetchRelation 이 null 반환.
  fetchRelation: () => Promise<TodayRelationMeta | null>;
  // relation id 기준 chart fetch. chart 미생성 시 null (UI 는 nickname 만 표시).
  fetchRelationChart: (relationId: string) => Promise<ChartCore | null>;
  callLlm: (input: TodayLlmInput) => Promise<DailyHapCard>;
  saveCard: (card: DailyHapCard) => Promise<void>;
  // Task 1: 옵셔널 instrumentation 콜백. 성공·실패 양쪽에서 정확히 1회 호출됨.
  // 비동기 INSERT (error_events 적재 등) 가 응답 직전에 완료되도록 builder 가 await 한다.
  recordTrace?: (trace: TodayTrace) => void | Promise<void>;
  today_date: string;
}

const TEMPLATE: DailyHapCard = {
  headline: '오늘 메시지를 준비하지 못했어요. 내일 다시 찾아주세요.',
  headline_reason: '오늘 해석 데이터를 불러오지 못해 안전한 기본 안내를 보여드려요.',
  avoid_phrase: '급하게 단정하는 말',
  avoid_phrase_reason: '오늘은 개인 맞춤 해석이 준비되지 않아 중요한 판단을 서두르지 않는 편이 안전해요.',
  favorable_action: '가벼운 정리부터 하기',
  favorable_action_reason: '새로운 해석이 없을 때는 일정과 마음을 먼저 정돈하면 하루 흐름을 안정적으로 가져갈 수 있어요.',
  reused_from_yesterday: false,
};

function applyRelationMeta(
  card: DailyHapCard,
  relation: TodayRelationMeta | null,
  relationChart: ChartCore | null,
  selfChart: ChartCore,
  todayDate: string,
): DailyHapCard {
  if (!relation) {
    return card;
  }
  // chart 존재 시에만 결정형 점수 산출 (ADR-035), 미존재 시 null
  const todayCompatScore = relationChart
    ? computeTodayCompatScore(selfChart, relationChart, todayDate)
    : null;
  return {
    ...card,
    relation_id: relation.id,
    relation_nickname: relation.nickname,
    today_compat_score: todayCompatScore,
  };
}

export async function buildDailyHap(deps: BuildDailyHapDeps): Promise<DailyHapResult> {
  const t0 = performance.now();
  const phases: TodayTracePhase[] = [];
  let failedPhase: string | undefined;
  let errorMessage: string | undefined;

  // 단계별 latency 측정. throw 시 failedPhase·errorMessage 캡처 후 재-throw.
  // yesterdayCache 같은 fallback 단계가 이 함수를 거치면 failedPhase 가 덮어쓰일 수 있으므로
  // 회복 경로에서는 measure() 대신 measurePhaseOnly() 를 사용한다.
  async function measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } catch (err) {
      failedPhase = name;
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      phases.push({ name, durationMs: performance.now() - start });
    }
  }

  // failedPhase 를 덮어쓰지 않고 phase 시간만 기록 (회복 단계용).
  async function measurePhaseOnly<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
    const start = performance.now();
    try {
      return await fn();
    } catch {
      return null;
    } finally {
      phases.push({ name, durationMs: performance.now() - start });
    }
  }

  async function flushTrace(extra?: { failedPhase?: string; errorMessage?: string }) {
    // recordTrace 가 async 면 await — 실패 트레이스의 error_events INSERT 가 응답 직전에 완료되게.
    // sync 반환이면 즉시 resolve, 무비용.
    await deps.recordTrace?.({
      phases: [...phases],
      totalMs: performance.now() - t0,
      failedPhase: extra?.failedPhase ?? failedPhase,
      errorMessage: extra?.errorMessage ?? errorMessage,
    });
  }

  const cached = await measure('todayCache', deps.fetchTodayCache);
  if (cached) {
    await flushTrace();
    return cached;
  }

  const selfChart = await measure('userChart', deps.fetchUserChart);
  if (!selfChart) {
    await flushTrace({ failedPhase: 'userChart', errorMessage: 'chart_null' });
    return TEMPLATE;
  }

  // 인연 메타 + 인연 chart fetch (인연 0건 사용자면 모두 null)
  const relation = await measure('relation', deps.fetchRelation);
  const relationChart = relation
    ? await measure('relationChart', () => deps.fetchRelationChart(relation.id))
    : null;

  try {
    const baseCard = await measure('llm', () =>
      deps.callLlm({
        self_chart: selfChart,
        relation_chart: relationChart,
        today_date: deps.today_date,
      }),
    );
    const card = applyRelationMeta(baseCard, relation, relationChart, selfChart, deps.today_date);
    await measure('save', () => deps.saveCard(card));
    await flushTrace();
    return card;
  } catch {
    // measure 가 이미 failedPhase + errorMessage 캡처. yesterdayCache 회복 단계는 라벨 보존.
    const yesterday = await measurePhaseOnly('yesterdayCache', deps.fetchYesterdayCache);
    await flushTrace();
    if (yesterday) return { ...yesterday, reused_from_yesterday: true };
    return TEMPLATE;
  }
}
