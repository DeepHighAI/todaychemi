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
  const cached = await deps.fetchTodayCache();
  if (cached) return cached;

  const selfChart = await deps.fetchUserChart();
  if (!selfChart) return TEMPLATE;

  // 인연 메타 + 인연 chart fetch (인연 0건 사용자면 모두 null)
  const relation = await deps.fetchRelation();
  const relationChart = relation ? await deps.fetchRelationChart(relation.id) : null;

  try {
    const baseCard = await deps.callLlm({
      self_chart: selfChart,
      relation_chart: relationChart,
      today_date: deps.today_date,
    });
    const card = applyRelationMeta(baseCard, relation, relationChart, selfChart, deps.today_date);
    await deps.saveCard(card);
    return card;
  } catch {
    const yesterday = await deps.fetchYesterdayCache();
    if (yesterday) return { ...yesterday, reused_from_yesterday: true };
    return TEMPLATE;
  }
}
