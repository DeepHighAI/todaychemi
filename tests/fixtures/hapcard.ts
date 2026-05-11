import type { ChartCore, YunseCore } from '@/types/chart';
import type { HapcardResult, HapcardVisuals } from '@/types/hapcard';

export const MOCK_YUNSE_CORE: YunseCore = {
  daeun: {
    start_age: 7,
    list: Array.from({ length: 10 }, (_, i) => ({ age: 7 + 10 * i, pillar: '갑자', year: 1990 + 10 * i })),
    current_index: 3,
  },
  seyun: { current_pillar: '병오', current_year: 2026 },
  wolun: { current_pillar: '계사', current_month: '2026-05' },
  iliun: { today_pillar: '갑자', today_date: '2026-05-07' },
};

export const mockChartCoreSelf: ChartCore = {
  year_pillar: '갑자',
  month_pillar: '을축',
  day_pillar: '갑인',
  hour_pillar: null,
  day_master_element: '목',
  five_elements_counts: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 },
  gender_normalized: 'M',
  yunse: MOCK_YUNSE_CORE,
};

export const mockChartCoreRelation: ChartCore = {
  year_pillar: '기묘',
  month_pillar: '경진',
  day_pillar: '병오',
  hour_pillar: null,
  day_master_element: '화',
  five_elements_counts: { 목: 1, 화: 3, 토: 2, 금: 1, 수: 1 },
  gender_normalized: 'F',
  yunse: MOCK_YUNSE_CORE,
};

export const mockVisuals: HapcardVisuals = {
  user: {
    day_pillar: mockChartCoreSelf.day_pillar,
    day_master_element: mockChartCoreSelf.day_master_element,
    five_elements_counts: mockChartCoreSelf.five_elements_counts,
  },
  relation: {
    day_pillar: mockChartCoreRelation.day_pillar,
    day_master_element: mockChartCoreRelation.day_master_element,
    five_elements_counts: mockChartCoreRelation.five_elements_counts,
  },
};

export const mockHapcardResult: HapcardResult = {
  hapcard_id: 'h1',
  user_id: 'u1',
  relation_id: 'r1',
  mode: '친구합',
  compat_score: 73,
  score_breakdown: { hap_chung_hyung_hae: 20, sipsin: 18, ohaeng: 22, yunse_adjustment: 0, mode_adjustment: 13 },
  content: {
    main_text: '두 사람의 합은 강합니다.',
    cause_factors: [],
    classic_citation: [],
    actions: [],
    why_cards: [],
  },
  prompt_version: 'v0.2',
  llm_model: 'gpt-5',
  cache_key: 'abc123',
  user_chart_hash: 'uh1',
  relation_chart_hash: 'rh1',
  archived_at: null,
  version_label: null,
  created_at: '2026-05-05T10:00:00Z',
};

export function withVisuals(overrides?: Partial<HapcardResult>): HapcardResult {
  return { ...mockHapcardResult, visuals: mockVisuals, ...overrides };
}
