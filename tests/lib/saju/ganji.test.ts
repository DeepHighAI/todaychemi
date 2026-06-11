import { describe, it, expect } from 'vitest';

import {
  STEMS,
  BRANCHES,
  STEM_INFO,
  BRANCH_INFO,
  GENERATES,
  CONTROLS,
  GENERATED_BY,
  CONTROLLED_BY,
  SIXTY_GAPJA,
  splitPillar,
  gapjaIndex,
  gapjaKo,
  normalizeGanji,
  type Element5,
} from '@/lib/saju/ganji';

describe('ganji foundation tables', () => {
  it('has 10 stems and 12 branches in canonical order', () => {
    expect(STEMS).toHaveLength(10);
    expect(BRANCHES).toHaveLength(12);
    expect(STEMS[0]).toBe('甲');
    expect(STEMS[9]).toBe('癸');
    expect(BRANCHES[0]).toBe('子');
    expect(BRANCHES[11]).toBe('亥');
  });

  it('STEM_INFO covers all 10 stems with element/yinyang/ko', () => {
    expect(Object.keys(STEM_INFO)).toHaveLength(10);
    expect(STEM_INFO['甲']).toEqual({ element: '목', yinyang: '양', ko: '갑' });
    expect(STEM_INFO['乙']).toEqual({ element: '목', yinyang: '음', ko: '을' });
    expect(STEM_INFO['丙'].element).toBe('화');
    expect(STEM_INFO['丁'].element).toBe('화');
    expect(STEM_INFO['戊'].element).toBe('토');
    expect(STEM_INFO['己'].element).toBe('토');
    expect(STEM_INFO['庚'].element).toBe('금');
    expect(STEM_INFO['辛'].element).toBe('금');
    expect(STEM_INFO['壬'].element).toBe('수');
    expect(STEM_INFO['癸'].element).toBe('수');
  });

  it('BRANCH_INFO covers all 12 branches with element/yinyang/ko/animal_ko', () => {
    expect(Object.keys(BRANCH_INFO)).toHaveLength(12);
    expect(BRANCH_INFO['子']).toEqual({
      element: '수',
      yinyang: '양',
      ko: '자',
      animal_ko: '쥐',
    });
    expect(BRANCH_INFO['寅']).toEqual({
      element: '목',
      yinyang: '양',
      ko: '인',
      animal_ko: '호랑이',
    });
    expect(BRANCH_INFO['亥']).toEqual({
      element: '수',
      yinyang: '음',
      ko: '해',
      animal_ko: '돼지',
    });
    expect(BRANCH_INFO['丑'].element).toBe('토');
    expect(BRANCH_INFO['卯'].element).toBe('목');
    expect(BRANCH_INFO['辰'].element).toBe('토');
    expect(BRANCH_INFO['巳'].element).toBe('화');
    expect(BRANCH_INFO['午'].element).toBe('화');
    expect(BRANCH_INFO['未'].element).toBe('토');
    expect(BRANCH_INFO['申'].element).toBe('금');
    expect(BRANCH_INFO['酉'].element).toBe('금');
    expect(BRANCH_INFO['戌'].element).toBe('토');
  });

  it('splits yinyang 5/5 for stems and 6/6 for branches (체 기준)', () => {
    const yangStems = STEMS.filter((s) => STEM_INFO[s].yinyang === '양');
    const yinStems = STEMS.filter((s) => STEM_INFO[s].yinyang === '음');
    expect(yangStems).toHaveLength(5);
    expect(yinStems).toHaveLength(5);

    const yangBranches = BRANCHES.filter((b) => BRANCH_INFO[b].yinyang === '양');
    const yinBranches = BRANCHES.filter((b) => BRANCH_INFO[b].yinyang === '음');
    expect(yangBranches).toHaveLength(6);
    expect(yinBranches).toHaveLength(6);
  });

  it('branch yinyang follows index parity (체 기준: 짝수=양, 홀수=음)', () => {
    BRANCHES.forEach((b, i) => {
      expect(BRANCH_INFO[b].yinyang).toBe(i % 2 === 0 ? '양' : '음');
    });
  });

  it('stem yinyang follows index parity (짝수=양, 홀수=음)', () => {
    STEMS.forEach((s, i) => {
      expect(STEM_INFO[s].yinyang).toBe(i % 2 === 0 ? '양' : '음');
    });
  });
});

describe('five element relations', () => {
  const ELEMENTS: readonly Element5[] = ['목', '화', '토', '금', '수'];

  it('GENERATES forms a 5-cycle (목→화→토→금→수→목)', () => {
    expect(GENERATES['목']).toBe('화');
    expect(GENERATES['화']).toBe('토');
    expect(GENERATES['토']).toBe('금');
    expect(GENERATES['금']).toBe('수');
    expect(GENERATES['수']).toBe('목');
  });

  it('CONTROLS forms a 5-cycle (목→토→수→화→금→목)', () => {
    expect(CONTROLS['목']).toBe('토');
    expect(CONTROLS['토']).toBe('수');
    expect(CONTROLS['수']).toBe('화');
    expect(CONTROLS['화']).toBe('금');
    expect(CONTROLS['금']).toBe('목');
  });

  it('GENERATED_BY is the inverse of GENERATES', () => {
    for (const el of ELEMENTS) {
      expect(GENERATED_BY[GENERATES[el]]).toBe(el);
      expect(GENERATES[GENERATED_BY[el]]).toBe(el);
    }
  });

  it('CONTROLLED_BY is the inverse of CONTROLS', () => {
    for (const el of ELEMENTS) {
      expect(CONTROLLED_BY[CONTROLS[el]]).toBe(el);
      expect(CONTROLS[CONTROLLED_BY[el]]).toBe(el);
    }
  });
});

describe('SIXTY_GAPJA', () => {
  it('has exactly 60 unique pillars starting 甲子 and ending 癸亥', () => {
    expect(SIXTY_GAPJA).toHaveLength(60);
    expect(new Set(SIXTY_GAPJA).size).toBe(60);
    expect(SIXTY_GAPJA[0]).toBe('甲子');
    expect(SIXTY_GAPJA[1]).toBe('乙丑');
    expect(SIXTY_GAPJA[59]).toBe('癸亥');
  });

  it('gapjaIndex is bijective over the full cycle', () => {
    SIXTY_GAPJA.forEach((pillar, i) => {
      expect(gapjaIndex(pillar)).toBe(i);
    });
  });

  it('splitPillar roundtrips every gapja', () => {
    for (const pillar of SIXTY_GAPJA) {
      const { stem, branch } = splitPillar(pillar);
      expect(`${stem}${branch}`).toBe(pillar);
    }
  });

  it('every gapja pairs same-parity stem and branch', () => {
    for (const pillar of SIXTY_GAPJA) {
      const { stem, branch } = splitPillar(pillar);
      expect(STEMS.indexOf(stem) % 2).toBe(BRANCHES.indexOf(branch) % 2);
    }
  });

  it('gapjaIndex throws for parity-mismatched pillar (60갑자 미존재)', () => {
    expect(() => gapjaIndex('甲丑')).toThrow();
    expect(() => gapjaIndex('乙子')).toThrow();
  });
});

describe('splitPillar validation', () => {
  it('parses a valid hanja pillar', () => {
    expect(splitPillar('甲子')).toEqual({ stem: '甲', branch: '子' });
    expect(splitPillar('癸亥')).toEqual({ stem: '癸', branch: '亥' });
  });

  it('throws for invalid input', () => {
    expect(() => splitPillar('')).toThrow();
    expect(() => splitPillar('甲')).toThrow();
    expect(() => splitPillar('甲子甲')).toThrow();
    expect(() => splitPillar('甲甲')).toThrow();
    expect(() => splitPillar('子甲')).toThrow();
    expect(() => splitPillar('ab')).toThrow();
    expect(() => splitPillar('갑자')).toThrow();
  });
});

describe('gapjaKo', () => {
  it('converts hanja pillar to korean reading', () => {
    expect(gapjaKo('庚寅')).toBe('경인');
    expect(gapjaKo('甲子')).toBe('갑자');
    expect(gapjaKo('癸亥')).toBe('계해');
  });
});

describe('normalizeGanji', () => {
  it('converts korean reading to hanja', () => {
    expect(normalizeGanji('갑자')).toBe('甲子');
    expect(normalizeGanji('경인')).toBe('庚寅');
    expect(normalizeGanji('계해')).toBe('癸亥');
    expect(normalizeGanji('신신')).toBe('辛申'); // 위치 기반: 천간 신=辛, 지지 신=申
  });

  it('passes hanja through unchanged', () => {
    expect(normalizeGanji('甲子')).toBe('甲子');
    expect(normalizeGanji('庚寅')).toBe('庚寅');
  });

  it('converts mixed hangul/hanja per position', () => {
    expect(normalizeGanji('갑子')).toBe('甲子');
    expect(normalizeGanji('甲자')).toBe('甲子');
  });

  it('returns non-convertible input unchanged', () => {
    expect(normalizeGanji('')).toBe('');
    expect(normalizeGanji('갑')).toBe('갑');
    expect(normalizeGanji('xx')).toBe('xx');
    expect(normalizeGanji('갑갑')).toBe('갑갑'); // 갑은 지지 독음이 아님
    expect(normalizeGanji('자자')).toBe('자자'); // 자는 천간 독음이 아님
    expect(normalizeGanji('갑자갑')).toBe('갑자갑');
  });

  it('roundtrips gapjaKo for all 60 gapja', () => {
    for (const pillar of SIXTY_GAPJA) {
      expect(normalizeGanji(gapjaKo(pillar))).toBe(pillar);
    }
  });
});
