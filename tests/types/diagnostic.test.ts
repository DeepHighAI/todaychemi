import { describe, it, expectTypeOf } from 'vitest';
import type { ClassicCitation, WhatifContent } from '@/types/diagnostic';

describe('WhatifContent', () => {
  const baseContent = {
    body: '가'.repeat(360),
    keywords: ['k1', 'k2', 'k3', 'k4', 'k5'] as [string, string, string, string, string],
    today_context: {
      title: '오늘의 나는?',
      summary: '오늘은 시작과 조율을 함께 보는 날이에요.',
      day_signal: '일운 기준으로 작은 시작이 좋아요.',
    },
    saju_basis: {
      day_master: '화',
      dominant_sipsin: ['식상'],
      missing_sipsin: ['재성'],
      sinkang: '중화',
      yongsin_candidates: ['금'],
      notes: ['표현성이 있어요.', '정리는 보완돼요.', '속도 조절이 좋아요.'] as [string, string, string],
    },
    situation_reading: {
      strength: ['말문이 열려요.', '실행이 쉬워요.', '분위기를 밝혀요.'] as [string, string, string],
      caution: ['확정을 늦춰요.', '조건을 확인해요.', '혼자 단정하지 않아요.'] as [string, string, string],
    },
    do_first: ['d1', 'd2', 'd3'] as [string, string, string],
    avoid_today: ['a1', 'a2'] as [string, string],
  } satisfies Omit<WhatifContent, 'classic_citation' | 'first_meet_tips'>;

  it('classic_citation 선택 필드 — 타입 허용', () => {
    const citation: ClassicCitation = {
      asset_id: 'asset-1',
      source_title: '적천수',
      source_chapter: '제1장',
      original_text: '원문',
      modern_translation: '현대어',
    };
    const content: WhatifContent = {
      ...baseContent,
      classic_citation: [citation],
    };
    expectTypeOf(content.classic_citation).toEqualTypeOf<ClassicCitation[] | undefined>();
  });

  it('classic_citation 없을 때도 WhatifContent 유효', () => {
    const content: WhatifContent = {
      ...baseContent,
    };
    expectTypeOf(content.classic_citation).toEqualTypeOf<ClassicCitation[] | undefined>();
  });
});
