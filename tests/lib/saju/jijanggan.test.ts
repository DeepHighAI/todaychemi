import { describe, it, expect } from 'vitest';

import {
  JIJANGGAN,
  JIJANGGAN_WEIGHTS,
  FOUR_STORAGE_BRANCHES,
  jijangganWeightsFor,
  principalStem,
  type JijangganEntry,
} from '@/lib/saju/jijanggan';
import { STEMS, BRANCHES, BRANCH_INFO, STEM_INFO } from '@/lib/saju/ganji';

import {
  SSAJU_JIJANGGAN_TABLE,
  SSAJU_STEM_YINYANG,
  SSAJU_BRANCH_YINYANG,
} from '../../fixtures/ssaju-tables';

describe('JIJANGGAN table', () => {
  it('deep-equals the ssaju k table (12 branches)', () => {
    expect(JIJANGGAN).toEqual(SSAJU_JIJANGGAN_TABLE);
  });

  it('covers all 12 branches with a non-null 정기', () => {
    expect(Object.keys(JIJANGGAN)).toHaveLength(12);
    for (const branch of BRANCHES) {
      const entry: JijangganEntry = JIJANGGAN[branch];
      expect(entry.정기).toBeTruthy();
    }
  });

  it('정기 element always equals the branch surface element (12지 전수)', () => {
    for (const branch of BRANCHES) {
      const principal = JIJANGGAN[branch].정기;
      expect(STEM_INFO[principal].element).toBe(BRANCH_INFO[branch].element);
    }
  });
});

describe('JIJANGGAN_WEIGHTS', () => {
  it('uses integer x10 scale (정기 10 / 중기 5 / 여기 3)', () => {
    expect(JIJANGGAN_WEIGHTS).toEqual({ 정기: 10, 중기: 5, 여기: 3 });
    for (const w of Object.values(JIJANGGAN_WEIGHTS)) {
      expect(Number.isInteger(w)).toBe(true);
    }
  });
});

// R1 (derived_version 2, 2026-06-12 사용자 확정): 사계월(辰戌丑未)은 고전 사령 일수
// (三命通會 — 여기 7일 > 중기[묘고] 5일)에 맞춰 중기/여기 가중 교환
describe('jijangganWeightsFor — 사계월 R1', () => {
  it('사계월(辰戌丑未) → 여기 5 > 중기 3 (서열 교환)', () => {
    for (const branch of ['辰', '戌', '丑', '未'] as const) {
      expect(jijangganWeightsFor(branch)).toEqual({ 정기: 10, 중기: 3, 여기: 5 });
    }
  });

  it('비사계월 8지 → 기본 가중(정기 10 / 중기 5 / 여기 3)', () => {
    for (const branch of BRANCHES) {
      if (FOUR_STORAGE_BRANCHES.has(branch)) continue;
      expect(jijangganWeightsFor(branch)).toEqual({ 정기: 10, 중기: 5, 여기: 3 });
    }
  });

  it('사계월은 항상 3슬롯 전부 보유 — 가중 교환이 총합을 보존', () => {
    for (const branch of FOUR_STORAGE_BRANCHES) {
      const entry = JIJANGGAN[branch];
      expect(entry.여기).not.toBeNull();
      expect(entry.중기).not.toBeNull();
    }
  });
});

describe('principalStem', () => {
  it('returns the 정기 stem for every branch', () => {
    for (const branch of BRANCHES) {
      expect(principalStem(branch)).toBe(JIJANGGAN[branch].정기);
    }
  });

  it('matches classic principal stems', () => {
    expect(principalStem('子')).toBe('癸');
    expect(principalStem('寅')).toBe('甲');
    expect(principalStem('午')).toBe('丁');
    expect(principalStem('亥')).toBe('壬');
  });
});

describe('ganji yinyang conformance against ssaju', () => {
  it('STEM_INFO yinyang matches ssaju T table', () => {
    for (const stem of STEMS) {
      expect(STEM_INFO[stem].yinyang).toBe(SSAJU_STEM_YINYANG[stem]);
    }
  });

  it('BRANCH_INFO yinyang matches ssaju v table', () => {
    for (const branch of BRANCHES) {
      expect(BRANCH_INFO[branch].yinyang).toBe(SSAJU_BRANCH_YINYANG[branch]);
    }
  });
});
