// scripts/verify-ssaju-accuracy.ts
// G0 gate: Phase 0 진입 전 ssaju 라이브러리 신뢰성 검증
// docs/specs/manseryeok_validation.md 참조

import fs from 'node:fs';
import path from 'node:path';
import { calculateSaju } from 'ssaju';

interface ReferenceSample {
  id: string;
  category: 'normal' | 'boundary' | 'edge';
  input: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    gender: '남' | '여';
    calendar: 'solar' | 'lunar';
  };
  expected: {
    year_pillar: string;
    month_pillar: string;
    day_pillar: string;
    hour_pillar: string;
    day_master_stem: string;
    five_elements_counts: Record<string, number>;
    source: 'kasi_derived' | 'ssaju_seed_pending_kasi_validation' | 'kasi_authoritative';
  };
}

const FIXTURES = path.join(__dirname, '..', 'tests', 'fixtures', 'kasi_reference_100.json');
const samples: ReferenceSample[] = JSON.parse(fs.readFileSync(FIXTURES, 'utf-8'));

const results = samples.map((s) => {
  try {
    const r = calculateSaju(s.input);
    const computed = {
      year_pillar: r.pillars.year,
      month_pillar: r.pillars.month,
      day_pillar: r.pillars.day,
      hour_pillar: r.pillars.hour,
      day_master_stem: r.dayStem,
      five_elements_counts: r.fiveElements,
    };
    const overall_match =
      s.expected.year_pillar !== '_ERROR' &&
      computed.year_pillar === s.expected.year_pillar &&
      computed.month_pillar === s.expected.month_pillar &&
      computed.day_pillar === s.expected.day_pillar &&
      computed.hour_pillar === s.expected.hour_pillar;
    return { id: s.id, category: s.category, overall_match, computed, expected: s.expected };
  } catch (err) {
    console.warn(`WARN: ${s.id} calculation failed: ${(err as Error).message}`);
    return { id: s.id, category: s.category, overall_match: false, computed: null, expected: s.expected };
  }
});

const report = {
  total_samples: results.length,
  accuracy: results.length > 0 ? results.filter((r) => r.overall_match).length / results.length : 0,
  by_category: {
    normal: {
      total: results.filter((r) => r.category === 'normal').length,
      passed: results.filter((r) => r.category === 'normal' && r.overall_match).length,
    },
    boundary: {
      total: results.filter((r) => r.category === 'boundary').length,
      passed: results.filter((r) => r.category === 'boundary' && r.overall_match).length,
    },
    edge: {
      total: results.filter((r) => r.category === 'edge').length,
      passed: results.filter((r) => r.category === 'edge' && r.overall_match).length,
    },
  },
  failed_samples: results.filter((r) => !r.overall_match).map((r) => ({
    id: r.id,
    category: r.category,
    computed: r.computed,
    expected: r.expected,
  })),
  generated_at: new Date().toISOString(),
};

const out = path.join(__dirname, '..', 'tests', 'fixtures', 'ssaju_verification_report.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2));

console.log(`Total: ${report.total_samples}`);
console.log(`Accuracy: ${(report.accuracy * 100).toFixed(2)}%`);
console.log(`Normal: ${report.by_category.normal.passed}/${report.by_category.normal.total}`);
console.log(`Boundary: ${report.by_category.boundary.passed}/${report.by_category.boundary.total}`);
console.log(`Edge: ${report.by_category.edge.passed}/${report.by_category.edge.total}`);

if (report.accuracy < 0.98) {
  console.error('FAIL: accuracy below 98% — see docs/specs/manseryeok_validation.md for Tier fallback');
  process.exit(1);
}
console.log('PASS: G0 manseryeok gate');
