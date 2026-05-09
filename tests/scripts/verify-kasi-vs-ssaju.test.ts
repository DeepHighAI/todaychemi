import { describe, it, expect } from 'vitest';
import { compareKasiVsSsaju } from '../../scripts/lib/verify-helpers';
import type { KasiFixtureRecord } from '@/lib/kasi/seed-runner';

function makeRecord(id: string, category: 'normal' | 'boundary' | 'edge', yp = '庚午', dp = '壬子'): KasiFixtureRecord {
  return {
    id,
    category,
    input: { year: 1990, month: 3, day: 15, hour: 14, minute: 30, gender: '남', calendar: 'solar' },
    expected: {
      year_pillar: yp, month_pillar: '庚子', day_pillar: dp, hour_pillar: '丁未',
      day_master_stem: '壬', five_elements_counts: { 목: 0, 화: 2, 토: 1, 금: 2, 수: 3 },
      source: 'kasi_authoritative',
    },
  };
}

const MATCH_FN = (r: KasiFixtureRecord) => ({
  year_pillar: r.expected.year_pillar,
  month_pillar: r.expected.month_pillar,
  day_pillar: r.expected.day_pillar,
  hour_pillar: r.expected.hour_pillar,
});

describe('compareKasiVsSsaju', () => {
  it('accuracy = 1.0 when all records match', () => {
    const records = [makeRecord('N001', 'normal'), makeRecord('N002', 'normal')];
    const result = compareKasiVsSsaju(records, MATCH_FN);
    expect(result.accuracy).toBe(1.0);
    expect(result.gate_passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('accuracy < 0.98 marks gate_passed=false', () => {
    const records = Array.from({ length: 100 }, (_, i) =>
      makeRecord(`N${String(i + 1).padStart(3, '0')}`, 'normal'),
    );
    // make 3 fail (3/100 = 97%)
    const computeFn = (r: KasiFixtureRecord) => {
      const base = MATCH_FN(r);
      if (r.id === 'N001' || r.id === 'N002' || r.id === 'N003') {
        return { ...base, year_pillar: 'WRONG' };
      }
      return base;
    };
    const result = compareKasiVsSsaju(records, computeFn);
    expect(result.accuracy).toBeCloseTo(0.97);
    expect(result.gate_passed).toBe(false);
  });

  it('per-category gate: normal=100% required', () => {
    const records = [
      makeRecord('N001', 'normal'), makeRecord('N002', 'normal'),
      makeRecord('B001', 'boundary'), makeRecord('E001', 'edge'),
    ];
    const computeFn = (r: KasiFixtureRecord) => {
      const base = MATCH_FN(r);
      if (r.id === 'N001') return { ...base, year_pillar: 'WRONG' };
      return base;
    };
    const result = compareKasiVsSsaju(records, computeFn);
    expect(result.by_category.normal.accuracy).toBeLessThan(1.0);
    expect(result.gate_passed).toBe(false);
  });

  it('includes failed sample ids in failures array', () => {
    const records = [makeRecord('N001', 'normal'), makeRecord('N002', 'normal')];
    const computeFn = (r: KasiFixtureRecord) => {
      if (r.id === 'N001') return { ...MATCH_FN(r), year_pillar: 'WRONG' };
      return MATCH_FN(r);
    };
    const result = compareKasiVsSsaju(records, computeFn);
    expect(result.failures).toContain('N001');
    expect(result.failures).not.toContain('N002');
  });
});
