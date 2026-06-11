import { describe, it, expect } from 'vitest';

import { SIPSIN_NAMES, sipsinOf, sipsinOfBranch, type SipsinName } from '@/lib/saju/sipsin';
import { STEMS, BRANCHES } from '@/lib/saju/ganji';
import { principalStem } from '@/lib/saju/jijanggan';

import { SSAJU_SIPSIN_TABLE } from '../../fixtures/ssaju-tables';

describe('SIPSIN_NAMES', () => {
  it('lists the 10 sipsin names exactly once', () => {
    expect(SIPSIN_NAMES).toHaveLength(10);
    expect(new Set(SIPSIN_NAMES).size).toBe(10);
    expect(SIPSIN_NAMES).toEqual([
      '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인',
    ]);
  });
});

describe('sipsinOf — 10x10 exhaustive conformance against ssaju D table', () => {
  it('matches ssaju for all 100 day-stem x target-stem pairs', () => {
    for (const dayStem of STEMS) {
      for (const target of STEMS) {
        expect(sipsinOf(dayStem, target), `${dayStem} x ${target}`).toBe(
          SSAJU_SIPSIN_TABLE[dayStem][target],
        );
      }
    }
  });

  it('returns 비견 for self pairs', () => {
    for (const stem of STEMS) {
      expect(sipsinOf(stem, stem)).toBe('비견');
    }
  });

  it('every result is a valid SipsinName', () => {
    const valid = new Set<SipsinName>(SIPSIN_NAMES);
    for (const dayStem of STEMS) {
      for (const target of STEMS) {
        expect(valid.has(sipsinOf(dayStem, target))).toBe(true);
      }
    }
  });
});

describe('sipsinOfBranch', () => {
  it('equals sipsinOf against the principal stem for all 10x12 pairs', () => {
    for (const dayStem of STEMS) {
      for (const branch of BRANCHES) {
        expect(sipsinOfBranch(dayStem, branch)).toBe(
          sipsinOf(dayStem, principalStem(branch)),
        );
      }
    }
  });

  it('matches hand-checked classic cases', () => {
    // 甲 일간, 子(정기 癸=수, 음) → 수生목 + 음양 상이 → 정인
    expect(sipsinOfBranch('甲', '子')).toBe('정인');
    // 甲 일간, 寅(정기 甲) → 비견
    expect(sipsinOfBranch('甲', '寅')).toBe('비견');
    // 丙 일간, 亥(정기 壬=수, 양) → 수克화 + 음양 동일 → 편관
    expect(sipsinOfBranch('丙', '亥')).toBe('편관');
    // 庚 일간, 卯(정기 乙=목, 음) → 금克목 + 음양 상이 → 정재
    expect(sipsinOfBranch('庚', '卯')).toBe('정재');
  });
});
