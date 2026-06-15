import { describe, expect, it } from 'vitest';
import { sanitizeWhatifBody, sanitizeWhatifContent } from '@/lib/whatif/content-sanitize';
import type { WhatifContent } from '@/types/diagnostic';

describe('sanitizeWhatifBody', () => {
  it('removes raw derived field annotations from the user-facing body', () => {
    const body =
      '일간이 토(일간: 토)이며 십신에서 비겁·식상이 우세하고(derived: dominant_sipsin = ["비겁","식상"]) 지장간·오행 분포에서 토가 중심인 신강(derived: sinkang.verdict = "신강")인 경우, 재성·관성·인성이 부족(derived: missing_sipsin = ["재성","관성","인성"])하므로 용신(derived: yongsin_candidates = ["금","목","수"])을 의식하면 좋다.';

    const sanitized = sanitizeWhatifBody(body);

    expect(sanitized).toBe(
      '일간이 토이며 십신에서 비겁·식상이 우세하고 지장간·오행 분포에서 토가 중심인 신강인 경우, 재성·관성·인성이 부족하므로 용신을 의식하면 좋다.',
    );
    expect(sanitized).not.toContain('derived');
    expect(sanitized).not.toContain('dominant_sipsin');
    expect(sanitized).not.toContain('sinkang.verdict');
    expect(sanitized).not.toContain('yongsin_candidates');
  });

  it('preserves normal Korean parentheses', () => {
    expect(sanitizeWhatifBody('감정 표현(말투)을 잠시 낮추면 좋다.')).toBe(
      '감정 표현(말투)을 잠시 낮추면 좋다.',
    );
  });

  it('preserves a parenthetical mentioning a keyword as prose (no : or =)', () => {
    // 'sinkang' 을 평범하게 언급하는 괄호 — key:value/key=value 형태가 아니므로 보존
    expect(sanitizeWhatifBody('균형(sinkang 관점)을 본다.')).toBe('균형(sinkang 관점)을 본다.');
  });
});

describe('sanitizeWhatifContent', () => {
  it('sanitizes body and leaves clean arrays (incl. keywords) unchanged', () => {
    const content: WhatifContent = {
      body: '신강(derived: sinkang.verdict = "신강")인 흐름',
      keywords: ['자기주도', '방어적반응', '위임부족', '실무회복', '용신활용'],
      do_first: ['듣기', '위임하기', '거리두기'],
    };

    expect(sanitizeWhatifContent(content)).toEqual({
      ...content,
      body: '신강인 흐름',
    });
  });

  it('sanitizes do_first and first_meet_tips entries, not just body', () => {
    const content: WhatifContent = {
      body: '평범한 흐름',
      keywords: ['자기주도', '방어적반응', '위임부족', '실무회복', '용신활용'],
      do_first: ['재성을 의식(derived: missing_sipsin = ["재성"])하세요', '듣기', '위임하기'],
      first_meet_tips: ['용신(derived: yongsin_candidates = ["금"])을 활용', '거리두기', '천천히'],
    };

    const out = sanitizeWhatifContent(content);

    expect(out.do_first[0]).toBe('재성을 의식하세요');
    expect(out.first_meet_tips?.[0]).toBe('용신을 활용');
    out.do_first.forEach((entry) => expect(entry).not.toContain('derived'));
    out.first_meet_tips?.forEach((entry) => expect(entry).not.toContain('derived'));
    // keywords 는 토큰이라 손대지 않는다
    expect(out.keywords).toEqual(content.keywords);
  });
});
