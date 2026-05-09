import type { KasiFixtureRecord } from '../../src/lib/kasi/seed-runner';

interface PillarValues {
  year_pillar: string;
  month_pillar: string | null;
  day_pillar: string;
  hour_pillar: string | null;
}

type ComputeFn = (record: KasiFixtureRecord) => PillarValues;

interface CategoryResult {
  total: number;
  passed: number;
  accuracy: number;
}

export interface VerifyResult {
  total_samples: number;
  accuracy: number;
  by_category: Record<'normal' | 'boundary' | 'edge', CategoryResult>;
  failures: string[];
  gate_passed: boolean;
  generated_at: string;
}

function pillarsMatch(computed: PillarValues, expected: KasiFixtureRecord['expected']): boolean {
  // 윤달(lunWolgeon="") 케이스: KASI가 month_pillar를 제공하지 않으므로 비교 생략
  const monthOk = expected.month_pillar === null || computed.month_pillar === expected.month_pillar;
  return (
    computed.year_pillar === expected.year_pillar &&
    monthOk &&
    computed.day_pillar === expected.day_pillar &&
    computed.hour_pillar === expected.hour_pillar
  );
}

export function compareKasiVsSsaju(
  records: KasiFixtureRecord[],
  computeFn: ComputeFn,
): VerifyResult {
  const byCategory: Record<string, { total: number; passed: number; accuracy: number }> = {
    normal: { total: 0, passed: 0, accuracy: 0 },
    boundary: { total: 0, passed: 0, accuracy: 0 },
    edge: { total: 0, passed: 0, accuracy: 0 },
  };
  const failures: string[] = [];
  let totalPassed = 0;

  for (const record of records) {
    const cat = record.category;
    byCategory[cat].total++;

    try {
      const computed = computeFn(record);
      const matched = pillarsMatch(computed, record.expected);
      if (matched) {
        totalPassed++;
        byCategory[cat].passed++;
      } else {
        failures.push(record.id);
      }
    } catch {
      failures.push(record.id);
    }
  }

  for (const cat of Object.keys(byCategory)) {
    const c = byCategory[cat];
    c.accuracy = c.total > 0 ? c.passed / c.total : 1;
  }

  const accuracy = records.length > 0 ? totalPassed / records.length : 1;

  // G0 게이트 판정 (manseryeok_validation.md §5)
  const gate_passed =
    accuracy >= 0.98 &&
    byCategory.normal.accuracy >= 1.0 &&
    byCategory.boundary.accuracy > 0.95 &&
    byCategory.edge.accuracy > 0.90;

  return {
    total_samples: records.length,
    accuracy,
    by_category: byCategory as Record<'normal' | 'boundary' | 'edge', CategoryResult>,
    failures,
    gate_passed,
    generated_at: new Date().toISOString(),
  };
}
