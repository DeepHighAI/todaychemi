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
  headline_reason: '',
  avoid_phrase: '',
  avoid_phrase_reason: '',
  favorable_action: '',
  favorable_action_reason: '',
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
