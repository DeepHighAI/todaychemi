import { describe, it, expect } from 'vitest';

import { STAGE12_ORDER, JANGSAENG_ANCHOR, stage12 } from '@/lib/saju/unseong';
import { STEMS, BRANCHES, STEM_INFO } from '@/lib/saju/ganji';

import {
  SSAJU_STAGE12_ORDER,
  SSAJU_JANGSAENG_ANCHOR,
  SSAJU_STEM_YINYANG,
} from '../../fixtures/ssaju-tables';

describe('STAGE12_ORDER / JANGSAENG_ANCHOR', () => {
  it('matches the ssaju stage order (장생 기점 12단계)', () => {
    expect([...STAGE12_ORDER]).toEqual([...SSAJU_STAGE12_ORDER]);
  });

  it('matches the ssaju jangsaeng anchors for all 10 stems', () => {
    expect(JANGSAENG_ANCHOR).toEqual(SSAJU_JANGSAENG_ANCHOR);
  });
});

describe('stage12 — 120-case conformance against ssaju bong formula', () => {
  it('matches the ssaju 양순음역 formula for all 10x12 pairs', () => {
    for (const stem of STEMS) {
      for (const branch of BRANCHES) {
        const branchIdx = BRANCHES.indexOf(branch);
        const anchorIdx = BRANCHES.indexOf(SSAJU_JANGSAENG_ANCHOR[stem]);
        const delta =
          SSAJU_STEM_YINYANG[stem] === '양' ? branchIdx - anchorIdx : anchorIdx - branchIdx;
        const offset = ((delta % 12) + 12) % 12;
        expect(stage12(stem, branch), `${stem} x ${branch}`).toBe(SSAJU_STAGE12_ORDER[offset]);
      }
    }
  });

  it('uses 체-기준 stem yinyang for direction (양간 순행 / 음간 역행)', () => {
    for (const stem of STEMS) {
      // 모든 천간에서 앵커 지지는 장생
      expect(stage12(stem, JANGSAENG_ANCHOR[stem])).toBe('장생');
      // 양간은 앵커+1이 목욕(순행), 음간은 앵커-1이 목욕(역행)
      const anchorIdx = BRANCHES.indexOf(JANGSAENG_ANCHOR[stem]);
      const step = STEM_INFO[stem].yinyang === '양' ? 1 : -1;
      const next = BRANCHES[(anchorIdx + step + 12) % 12];
      expect(stage12(stem, next)).toBe('목욕');
    }
  });

  it('matches classic anchor spot-checks', () => {
    expect(stage12('甲', '亥')).toBe('장생');
    expect(stage12('甲', '卯')).toBe('제왕');
    expect(stage12('甲', '寅')).toBe('건록');
    expect(stage12('乙', '午')).toBe('장생');
    expect(stage12('乙', '亥')).toBe('사');
    expect(stage12('庚', '巳')).toBe('장생');
    expect(stage12('辛', '子')).toBe('장생');
    expect(stage12('壬', '申')).toBe('장생');
  });
});
