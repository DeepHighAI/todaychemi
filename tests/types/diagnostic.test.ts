import { describe, it, expectTypeOf } from 'vitest';
import type { ClassicCitation, WhatifContent } from '@/types/diagnostic';

describe('WhatifContent', () => {
  it('classic_citation 선택 필드 — 타입 허용', () => {
    const citation: ClassicCitation = {
      asset_id: 'asset-1',
      source_title: '적천수',
      source_chapter: '제1장',
      original_text: '원문',
      modern_translation: '현대어',
    };
    const content: WhatifContent = {
      body: '가'.repeat(360),
      keywords: ['k1', 'k2', 'k3', 'k4', 'k5'],
      do_first: ['d1', 'd2', 'd3'],
      classic_citation: [citation],
    };
    expectTypeOf(content.classic_citation).toEqualTypeOf<ClassicCitation[] | undefined>();
  });

  it('classic_citation 없을 때도 WhatifContent 유효', () => {
    const content: WhatifContent = {
      body: '나'.repeat(360),
      keywords: ['a', 'b', 'c', 'd', 'e'],
      do_first: ['x', 'y', 'z'],
    };
    expectTypeOf(content.classic_citation).toEqualTypeOf<ClassicCitation[] | undefined>();
  });
});
