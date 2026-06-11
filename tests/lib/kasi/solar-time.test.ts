import { describe, it, expect } from 'vitest';

import {
  dayOfYear,
  equationOfTimeMinutes,
  apparentSolarMinutes,
} from '@/lib/kasi/solar-time';
import { minutesToBranchIndex, DEFAULT_BIRTH_LONGITUDE, KST_STANDARD_MERIDIAN } from '@/lib/kasi/constants';

describe('dayOfYear', () => {
  it('1월 1일 = 1, 12월 31일 = 365(평년)/366(윤년)', () => {
    expect(dayOfYear({ year: 2026, month: 1, day: 1 })).toBe(1);
    expect(dayOfYear({ year: 2026, month: 12, day: 31 })).toBe(365);
    expect(dayOfYear({ year: 2024, month: 12, day: 31 })).toBe(366);
  });

  it('1990-04-15 = 105 (normalize 픽스처 날짜)', () => {
    expect(dayOfYear({ year: 1990, month: 4, day: 15 })).toBe(105);
  });
});

describe('equationOfTimeMinutes (Spencer 1971 — 천문력 앵커 검증)', () => {
  // 천문력 근사값 대비 ±0.9분 허용 (Spencer 공식 자체 오차 ~±0.6분)
  it('2월 중순 ≈ −14.2분 (연중 최소 부근)', () => {
    expect(equationOfTimeMinutes({ year: 2026, month: 2, day: 11 })).toBeCloseTo(-14.2, 0);
  });

  it('11월 초 ≈ +16.4분 (연중 최대 부근)', () => {
    expect(equationOfTimeMinutes({ year: 2026, month: 11, day: 3 })).toBeCloseTo(16.4, 0);
  });

  it('7월 말 ≈ −6.5분', () => {
    const eot = equationOfTimeMinutes({ year: 2026, month: 7, day: 27 });
    expect(Math.abs(eot - -6.5)).toBeLessThan(0.9);
  });

  it('4월 중순 ≈ 0분 (영점 교차 부근)', () => {
    expect(Math.abs(equationOfTimeMinutes({ year: 1990, month: 4, day: 15 }))).toBeLessThan(0.9);
  });

  it('결정형 — 같은 날짜는 항상 같은 값', () => {
    const a = equationOfTimeMinutes({ year: 1995, month: 7, day: 20 });
    const b = equationOfTimeMinutes({ year: 1995, month: 7, day: 20 });
    expect(a).toBe(b);
  });
});

describe('apparentSolarMinutes (벽시계 → 진태양시 분 총합)', () => {
  const APR15 = { year: 1990, month: 4, day: 15 };

  it('표준 자오선(135°E)에서는 경도항 0 — EoT만 가감', () => {
    const eot = equationOfTimeMinutes(APR15);
    expect(apparentSolarMinutes(12, 0, KST_STANDARD_MERIDIAN, APR15)).toBeCloseTo(720 + eot, 6);
  });

  it('서울(126.978°E) 경도항 = −32.088분', () => {
    const eot = equationOfTimeMinutes(APR15);
    const got = apparentSolarMinutes(12, 0, DEFAULT_BIRTH_LONGITUDE, APR15);
    expect(got).toBeCloseTo(720 - 32.088 + eot, 3);
  });

  it('사용자 케이스: 17:05 서울 → 신시(申) 구간(15:00~17:00 진태양시)으로 이동', () => {
    const corrected = apparentSolarMinutes(17, 5, DEFAULT_BIRTH_LONGITUDE, APR15);
    expect(corrected).toBeGreaterThanOrEqual(900); // 15:00
    expect(corrected).toBeLessThan(1020); // 17:00
    expect(minutesToBranchIndex(corrected)).toBe(8); // 申
  });
});

describe('minutesToBranchIndex (분 해상도 시지 판정)', () => {
  it('자시 경계: 23:00(1380)~00:59(59) → 子(0)', () => {
    expect(minutesToBranchIndex(1380)).toBe(0);
    expect(minutesToBranchIndex(1439)).toBe(0);
    expect(minutesToBranchIndex(0)).toBe(0);
    expect(minutesToBranchIndex(59)).toBe(0);
    expect(minutesToBranchIndex(60)).toBe(1); // 丑
  });

  it('신/유 경계: 16:59(1019) → 申(8), 17:00(1020) → 酉(9)', () => {
    expect(minutesToBranchIndex(1019)).toBe(8);
    expect(minutesToBranchIndex(1019.9)).toBe(8);
    expect(minutesToBranchIndex(1020)).toBe(9);
  });

  it('음수/24h 초과 입력 정규화 (보정으로 자정 넘는 케이스)', () => {
    expect(minutesToBranchIndex(-2)).toBe(0); // 전날 23:58 → 子
    expect(minutesToBranchIndex(-70)).toBe(11); // 전날 22:50 → 亥
    expect(minutesToBranchIndex(1441)).toBe(0); // 다음날 00:01 → 子
  });
});
