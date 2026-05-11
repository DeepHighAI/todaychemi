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
  do_first: ['목표 설정하기', '우선순위 정하기', '작은 것부터 시작'],
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
    llm_model: 'gpt-5',
    cache_key: cacheKey,
    chart_hash: MOCK_CHART_HASH,
    created_at: '2026-05-09T00:00:00Z',
  };
}
