import { describe, it, expect } from 'vitest';
import { WhatifLlmOutputSchema } from '@/lib/whatif/output-schema';

const VALID_BODY = '가'.repeat(360); // 360자 (80-700 범위)

const BASE = {
  body: VALID_BODY,
  keywords: ['키워드1', '키워드2', '키워드3', '키워드4', '키워드5'] as [string, string, string, string, string],
  do_first: ['실행1', '실행2', '실행3'] as [string, string, string],
};

describe('WhatifLlmOutputSchema', () => {
  it('필수 3필드 — 정상 파싱', () => {
    const result = WhatifLlmOutputSchema.parse(BASE);
    expect(result.body).toHaveLength(360);
    expect(result.keywords).toHaveLength(5);
    expect(result.do_first).toHaveLength(3);
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

  it('body 80자 → PASS', () => {
    const result = WhatifLlmOutputSchema.parse({ ...BASE, body: '가'.repeat(80) });
    expect(result.body).toHaveLength(80);
  });

  it('body 79자 (80 미만) → REJECT', () => {
    expect(() =>
      WhatifLlmOutputSchema.parse({ ...BASE, body: '가'.repeat(79) }),
    ).toThrow();
  });

  it('body 701자 (700 초과) → REJECT', () => {
    expect(() =>
      WhatifLlmOutputSchema.parse({ ...BASE, body: '가'.repeat(701) }),
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
