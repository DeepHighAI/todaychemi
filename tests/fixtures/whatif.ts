import type { ChartCore } from '@/types/chart';
import type { WhatifLlmOutput } from '@/lib/whatif/output-schema';
import type { ClassicCitation, WhatifResult } from '@/types/diagnostic';

export const MOCK_CHART_CORE: ChartCore = {
  year_pillar: '갑자',
  month_pillar: '을축',
  day_pillar: '병인',
  hour_pillar: null,
  day_master_element: '화',
  five_elements_counts: { 목: 2, 화: 1, 토: 1, 금: 0, 수: 0 },
  gender_normalized: 'M',
  yunse: {
    daeun: {
      start_age: 7,
      current_index: 0,
      list: [{ age: 7, pillar: '갑자', year: 1990 }],
    },
    seyun: { current_pillar: '병오', current_year: 2026 },
    wolun: { current_pillar: '계사', current_month: '2026-05' },
    iliun: { today_pillar: '갑자', today_date: '2026-05-09' },
  },
};

export const MOCK_CHART_HASH = 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1';

export const MOCK_LLM_OUTPUT: WhatifLlmOutput = {
  body: '가'.repeat(360),
  keywords: ['집중', '전략', '실행', '협업', '성과'],
  today_context: {
    title: '오늘 일할 때 나는',
    summary: '오늘은 일의 우선순위를 먼저 잡고, 주변의 반응을 보며 속도를 조절하면 좋은 흐름이에요.',
    day_signal: '일운 갑자 기준으로 시작과 조율의 기운이 함께 들어옵니다.',
  },
  saju_basis: {
    day_master: '화',
    dominant_sipsin: ['식상', '비겁'],
    missing_sipsin: ['재성'],
    sinkang: '중화',
    yongsin_candidates: ['금', '수'],
    notes: ['화 일간의 표현성이 드러나요.', '식상 흐름이 실행력을 밀어줘요.', '재성 보완은 결과 정리에 도움돼요.'],
  },
  situation_reading: {
    strength: ['먼저 말문을 여는 힘이 있어요.', '일을 쪼개 실행하기 좋아요.', '분위기를 밝히는 역할을 맡기 쉬워요.'],
    caution: ['속도를 너무 올리면 놓치는 부분이 생겨요.', '확답 전 조건을 다시 봐야 해요.', '혼자 결론을 내리기보다 확인이 필요해요.'],
  },
  do_first: ['목표 설정하기', '우선순위 정하기', '작은 것부터 시작'],
  avoid_today: ['즉흥적으로 확정하기', '검토 없이 답장하기'],
};

export const MOCK_CITATION: ClassicCitation = {
  asset_id: 'asset-1',
  source_title: '적천수',
  source_chapter: '제1장',
  original_text: '원문 텍스트',
  modern_translation: '현대어 번역',
};

export const MOCK_LLM_OUTPUT_WITH_CITATION: WhatifLlmOutput = {
  ...MOCK_LLM_OUTPUT,
  classic_citation: [MOCK_CITATION],
};

export const MOCK_PROMPT_VERSION = 'v0.1';
export const MOCK_CACHE_KEY = 'cachecachecachecachecachecachecachecachecachecachecachecachecach';

export function makeMockInsertedRow(cacheKey: string = MOCK_CACHE_KEY): WhatifResult {
  return {
    id: 'whatif-uuid-1234',
    user_id: 'user-uuid-5678',
    type: 'work',
    content: MOCK_LLM_OUTPUT,
    prompt_version: MOCK_PROMPT_VERSION,
    llm_model: 'gpt-5-mini',
    cache_key: cacheKey,
    chart_hash: MOCK_CHART_HASH,
    target_date: '2026-05-09',
    created_at: '2026-05-09T00:00:00Z',
  };
}
