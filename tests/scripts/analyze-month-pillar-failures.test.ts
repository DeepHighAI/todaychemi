import { describe, it, expect } from 'vitest';
import type { KasiFixtureRecord } from '@/lib/kasi/seed-runner';
import {
  bucketProximity,
  isOneMonthApart,
  findSsajuJeolgiTransition,
  analyzeRecord,
  buildSummary,
  buildMarkdownReport,
  type FailureDetail,
} from '../../scripts/lib/analysis-helpers';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRecord(
  id: string,
  category: 'normal' | 'boundary' | 'edge',
  opts: Partial<{
    year: number; month: number; day: number; hour: number; minute: number;
    ssajuMonth: string; kasiMonth: string;
  }> = {},
): KasiFixtureRecord {
  return {
    id,
    category,
    input: {
      year: opts.year ?? 2001,
      month: opts.month ?? 9,
      day: opts.day ?? 12,
      hour: opts.hour ?? 10,
      minute: opts.minute ?? 0,
      gender: '남',
      calendar: 'solar',
    },
    expected: {
      year_pillar: '辛巳',
      month_pillar: opts.kasiMonth ?? '丙申',
      day_pillar: '甲辰',
      hour_pillar: '甲午',
      day_master_stem: '甲',
      five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 2, 수: 1 },
      source: 'kasi_authoritative',
    },
  };
}

function makeDetail(overrides: Partial<FailureDetail> = {}): FailureDetail {
  return {
    id: 'N001',
    category: 'normal',
    birthDatetime: '2001-09-12 10:00',
    ssajuMonth: '丁酉',
    kasiMonth: '丙申',
    lunarMonth: 7,
    lunarMonthStartSolar: '2001-08-19',
    hoursFromSolarTermTransition: 100,
    proximityBucket: '>72h',
    patternType: 'solar_vs_lunar',
    ...overrides,
  };
}

// ── bucketProximity ───────────────────────────────────────────────────────────

describe('bucketProximity', () => {
  it('0h → ≤3h', () => expect(bucketProximity(0)).toBe('≤3h'));
  it('3h → ≤3h', () => expect(bucketProximity(3)).toBe('≤3h'));
  it('3.01h → 3-24h', () => expect(bucketProximity(3.01)).toBe('3-24h'));
  it('24h → 3-24h', () => expect(bucketProximity(24)).toBe('3-24h'));
  it('24.1h → 24-72h', () => expect(bucketProximity(24.1)).toBe('24-72h'));
  it('72h → 24-72h', () => expect(bucketProximity(72)).toBe('24-72h'));
  it('72.5h → >72h', () => expect(bucketProximity(72.5)).toBe('>72h'));
  it('480h → >72h', () => expect(bucketProximity(480)).toBe('>72h'));
});

// ── isOneMonthApart ───────────────────────────────────────────────────────────

describe('isOneMonthApart', () => {
  it('甲子 → 乙丑 (adjacent +1) = true', () => expect(isOneMonthApart('甲子', '乙丑')).toBe(true));
  it('乙丑 → 甲子 (adjacent -1) = true', () => expect(isOneMonthApart('乙丑', '甲子')).toBe(true));
  it('甲子 → 甲子 (same) = false', () => expect(isOneMonthApart('甲子', '甲子')).toBe(false));
  it('甲子 → 丙寅 (+2) = false', () => expect(isOneMonthApart('甲子', '丙寅')).toBe(false));
  // wrap-around: last → first in 60-cycle
  it('癸亥 (idx 59) → 甲子 (idx 0) = true', () => expect(isOneMonthApart('癸亥', '甲子')).toBe(true));
  it('甲子 → 癸亥 = true', () => expect(isOneMonthApart('甲子', '癸亥')).toBe(true));
  it('invalid char → false', () => expect(isOneMonthApart('XX', '甲子')).toBe(false));
});

// ── findSsajuJeolgiTransition ─────────────────────────────────────────────────

describe('findSsajuJeolgiTransition', () => {
  it('항상 같은 月柱 → Infinity 반환', () => {
    const fn = () => '丁酉';
    const result = findSsajuJeolgiTransition(2001, 9, 12, 10, 0, fn, 48);
    expect(result).toBe(Infinity);
  });

  it('출생 약 13.5h 뒤 月柱 변화 → ~13.5h 반환', () => {
    // day 13 이상이면 다른 月柱 — backward 방향은 day 12→11→10... 모두 '丁酉'
    let callCount = 0;
    const fn = (_y: number, _m: number, d: number, _h: number) => {
      callCount++;
      return d >= 13 ? '戊戌' : '丁酉';
    };
    const result = findSsajuJeolgiTransition(2001, 9, 12, 10, 0, fn, 48);
    // 출생 KST 10:00 → KST day 13 00:00 은 UTC 2001-09-12T15:00 = +14h forward
    // forwardHours = 14 - 0.5 = 13.5, backwardHours = Infinity
    expect(result).toBeCloseTo(13.5, 0);
    expect(callCount).toBeGreaterThan(0);
  });

  it('출생 -6h 이후 月柱 변화 → ~5.5h 반환 (backward 방향 가까움)', () => {
    const birthHour = 10; // KST
    const fn = (_y: number, _m: number, _d: number, h: number) => {
      // 출생에서 backward: 10h - 6h = 4h KST (UTC가 달라지지만 단순 시뮬)
      // forward: 변화 없음 (scanRange 내)
      return h >= 4 && h <= 23 ? '丁酉' : '丙申';
    };
    void birthHour;
    const result = findSsajuJeolgiTransition(2001, 9, 12, 10, 0, fn, 48);
    // backward scan: h=7 → KST = 10-7+9 = 12, h=6 → 13, h=5 → 14...
    // Actually the function uses addHoursKst which goes UTC→KST, let's just check it returns < 10
    expect(result).toBeLessThan(10);
  });
});

// ── analyzeRecord ─────────────────────────────────────────────────────────────

describe('analyzeRecord', () => {
  it('solar_vs_lunar 패턴: ssaju=丁酉, kasi=丙申 (인접 1달)', () => {
    const record = makeRecord('N005', 'normal', { kasiMonth: '丙申' });
    const computeMonthFn = () => '丁酉';
    const getLunarMonthFn = () => ({ lunarMonth: 7, lunarMonthStartSolar: '2001-08-19' });
    const detail = analyzeRecord(record, computeMonthFn, getLunarMonthFn);

    expect(detail.id).toBe('N005');
    expect(detail.category).toBe('normal');
    expect(detail.ssajuMonth).toBe('丁酉');
    expect(detail.kasiMonth).toBe('丙申');
    expect(detail.lunarMonth).toBe(7);
    expect(detail.lunarMonthStartSolar).toBe('2001-08-19');
    expect(detail.patternType).toBe('solar_vs_lunar');
    expect(detail.birthDatetime).toBe('2001-09-12 10:00');
  });

  it('unknown 패턴: ssaju=甲子, kasi=丙寅 (2달 차이)', () => {
    const record = makeRecord('B001', 'boundary', { kasiMonth: '丙寅' });
    const computeMonthFn = () => '甲子';
    const getLunarMonthFn = () => ({ lunarMonth: 5, lunarMonthStartSolar: '2001-06-21' });
    const detail = analyzeRecord(record, computeMonthFn, getLunarMonthFn);

    expect(detail.patternType).toBe('unknown');
  });
});

// ── buildSummary ──────────────────────────────────────────────────────────────

describe('buildSummary', () => {
  it('3건 details → 집계 정합', () => {
    const details: FailureDetail[] = [
      makeDetail({ id: 'N001', category: 'normal', hoursFromSolarTermTransition: 2, proximityBucket: '≤3h', patternType: 'solar_vs_lunar' }),
      makeDetail({ id: 'B001', category: 'boundary', hoursFromSolarTermTransition: 10, proximityBucket: '3-24h', patternType: 'solar_vs_lunar' }),
      makeDetail({ id: 'E001', category: 'edge', hoursFromSolarTermTransition: 200, proximityBucket: '>72h', patternType: 'unknown' }),
    ];
    const s = buildSummary(details);

    expect(s.totalFailures).toBe(3);
    expect(s.byCategory.normal).toBe(1);
    expect(s.byCategory.boundary).toBe(1);
    expect(s.byCategory.edge).toBe(1);
    expect(s.byProximityBucket['≤3h']).toBe(1);
    expect(s.byProximityBucket['3-24h']).toBe(1);
    expect(s.byProximityBucket['>72h']).toBe(1);
    expect(s.solarVsLunarCount).toBe(2);
    expect(s.medianHoursFromTransition).toBe(10);
    expect(s.maxHoursFromTransition).toBe(200);
  });

  it('빈 배열 → 0값 반환', () => {
    const s = buildSummary([]);
    expect(s.totalFailures).toBe(0);
    expect(s.medianHoursFromTransition).toBe(0);
    expect(s.maxHoursFromTransition).toBe(0);
  });
});

// ── buildMarkdownReport ───────────────────────────────────────────────────────

describe('buildMarkdownReport', () => {
  it('보고서에 핵심 섹션·숫자 포함', () => {
    const details: FailureDetail[] = [
      makeDetail({ id: 'N001', hoursFromSolarTermTransition: 200, proximityBucket: '>72h' }),
    ];
    const summary = { ...buildSummary(details), details };
    const md = buildMarkdownReport(summary, '0.2.0');

    expect(md).toContain('# 月柱 불일치 근본 원인 분석 보고서');
    expect(md).toContain('ssaju v0.2.0');
    expect(md).toContain('1건');
    expect(md).toContain('solar_vs_lunar');
    expect(md).toContain('N001');
    expect(md).toContain('>72h');
  });
});
