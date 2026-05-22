import type { DailyHapCard, DailyHapResult } from '@/types/dailyHap';
import type { ChartCore } from '@/types/chart';

export interface BuildDailyHapDeps {
  fetchTodayCache: () => Promise<DailyHapCard | null>;
  fetchYesterdayCache: () => Promise<DailyHapCard | null>;
  fetchUserChart: () => Promise<ChartCore | null>;
  callLlm: (chart: ChartCore) => Promise<DailyHapCard>;
  saveCard: (card: DailyHapCard) => Promise<void>;
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

export async function buildDailyHap(deps: BuildDailyHapDeps): Promise<DailyHapResult> {
  const cached = await deps.fetchTodayCache();
  if (cached) return cached;

  const chart = await deps.fetchUserChart();
  if (!chart) return TEMPLATE;

  try {
    const card = await deps.callLlm(chart);
    await deps.saveCard(card);
    return card;
  } catch {
    const yesterday = await deps.fetchYesterdayCache();
    if (yesterday) return { ...yesterday, reused_from_yesterday: true };
    return TEMPLATE;
  }
}
