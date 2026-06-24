import { describe, it, expect } from 'vitest';
import { WhatifLlmOutputSchema } from '@/lib/whatif/output-schema';

const VALID_BODY = '가'.repeat(360); // 360자 (80-700 범위)

const BASE = {
  body: VALID_BODY,
  keywords: ['키워드1', '키워드2', '키워드3', '키워드4', '키워드5'] as [string, string, string, string, string],
  today_context: {
    title: '오늘 일할 때 나는',
    summary: '오늘은 시작과 조율의 흐름이 함께 보여서, 먼저 방향을 정하고 주변 반응을 확인하면 좋아요.',
    day_signal: '일운 갑자와 월운 계사가 함께 작동해요.',
  },
  saju_basis: {
    day_master: '화',
    dominant_sipsin: ['식상', '비겁'],
    missing_sipsin: ['재성'],
    sinkang: '중화',
    yongsin_candidates: ['금', '수'],
    notes: ['표현성이 드러나요.', '실행력이 강해요.', '결과 정리는 보완이 필요해요.'] as [string, string, string],
  },
  situation_reading: {
    strength: ['말문을 열기 좋아요.', '작게 실행하기 좋아요.', '분위기를 밝힐 수 있어요.'] as [string, string, string],
    caution: ['확답을 서두르지 마세요.', '조건을 다시 보세요.', '혼자 결론 내리지 마세요.'] as [string, string, string],
  },
  do_first: ['실행1', '실행2', '실행3'] as [string, string, string],
  avoid_today: ['즉흥 확정', '검토 없는 답장'] as [string, string],
};

describe('WhatifLlmOutputSchema', () => {
  it('구조화 필수 필드 — 정상 파싱', () => {
    const result = WhatifLlmOutputSchema.parse(BASE);
    expect(result.body).toHaveLength(360);
    expect(result.keywords).toHaveLength(5);
    expect(result.today_context.title).toBe('오늘 일할 때 나는');
    expect(result.saju_basis.notes).toHaveLength(3);
    expect(result.situation_reading.strength).toHaveLength(3);
    expect(result.do_first).toHaveLength(3);
    expect(result.avoid_today).toHaveLength(2);
  });

  it('keywords 4개 → REJECT', () => {
    expect(() =>
      WhatifLlmOutputSchema.parse({ ...BASE, keywords: ['k1', 'k2', 'k3', 'k4'] }),
    ).toThrow();
  });

  it('do_first 2개 → REJECT', () => {
    expect(() =>
      WhatifLlmOutputSchema.parse({ ...BASE, do_first: ['a', 'b'] }),
    ).toThrow();
  });

  it('avoid_today 1개 → REJECT', () => {
    expect(() =>
      WhatifLlmOutputSchema.parse({ ...BASE, avoid_today: ['a'] }),
    ).toThrow();
  });

  it('body 180자 → PASS', () => {
    const result = WhatifLlmOutputSchema.parse({ ...BASE, body: '가'.repeat(180) });
    expect(result.body).toHaveLength(180);
  });

  it('body 179자 (180 미만) → REJECT', () => {
    expect(() =>
      WhatifLlmOutputSchema.parse({ ...BASE, body: '가'.repeat(179) }),
    ).toThrow();
  });

  it('body 901자 (900 초과) → REJECT', () => {
    expect(() =>
      WhatifLlmOutputSchema.parse({ ...BASE, body: '가'.repeat(901) }),
    ).toThrow();
  });

  it('first_meet_tips 3개 (optional) → PASS', () => {
    const result = WhatifLlmOutputSchema.parse({
      ...BASE,
      first_meet_tips: ['팁1', '팁2', '팁3'],
    });
    expect(result.first_meet_tips).toEqual(['팁1', '팁2', '팁3']);
  });

  it('classic_citation 빈 배열 (optional) → PASS', () => {
    const result = WhatifLlmOutputSchema.parse({ ...BASE, classic_citation: [] });
    expect(result.classic_citation).toEqual([]);
  });

  it('classic_citation 항목 포함 → PASS', () => {
    const citation = {
      asset_id: 'asset-1',
      source_title: '적천수',
      source_chapter: '제1장',
      original_text: '원문',
      modern_translation: '현대어',
    };
    const result = WhatifLlmOutputSchema.parse({
      ...BASE,
      classic_citation: [citation],
    });
    expect(result.classic_citation![0].asset_id).toBe('asset-1');
  });
});
