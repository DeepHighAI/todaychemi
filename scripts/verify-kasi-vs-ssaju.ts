// scripts/verify-kasi-vs-ssaju.ts
// G0 게이트 재실행: KASI 진본 vs ssaju 일치율 검증
// docs/specs/manseryeok_validation.md §5 참조
// 실행: pnpm verify-kasi
import fs from 'node:fs';
import path from 'node:path';
import { calculateSaju } from 'ssaju';
import { compareKasiVsSsaju } from './lib/verify-helpers';
import type { KasiFixtureRecord } from '../src/lib/kasi/seed-runner';

const FIXTURES_PATH = path.join(__dirname, '..', 'tests', 'fixtures', 'kasi_reference_100.json');
const REPORT_PATH = path.join(__dirname, '..', 'reports', 'kasi_verification_report.json');

const records: KasiFixtureRecord[] = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8'));

// KASI 픽스처 source 확인
const unauthenticated = records.filter((r) => r.expected.source !== 'kasi_authoritative');
if (unauthenticated.length > 0) {
  console.error(`ERROR: ${unauthenticated.length}건이 kasi_authoritative source가 아닙니다.`);
  console.error('pnpm seed-kasi를 먼저 실행하세요.');
  process.exit(1);
}

const result = compareKasiVsSsaju(records, (record) => {
  const r = calculateSaju(record.input);
  return {
    year_pillar: r.pillars.year,
    month_pillar: r.pillars.month,
    day_pillar: r.pillars.day,
    hour_pillar: r.pillars.hour ?? null,
  };
});

// 리포트 저장
fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, JSON.stringify(result, null, 2), 'utf-8');

console.log(`\n── KASI vs ssaju G0 게이트 결과 ──`);
console.log(`ⓘ year/month/hour는 ssaju self-consistency. day_pillar만 KASI cross-validation (ADR-037).`);
console.log(`전체 accuracy:  ${(result.accuracy * 100).toFixed(1)}% (${result.accuracy >= 0.98 ? '✓' : '✗'} 기준 ≥98%)`);
const cat = result.by_category;
console.log(`  normal:       ${(cat.normal.accuracy * 100).toFixed(1)}% (${cat.normal.passed}/${cat.normal.total}) 기준 =100%`);
console.log(`  boundary:     ${(cat.boundary.accuracy * 100).toFixed(1)}% (${cat.boundary.passed}/${cat.boundary.total}) 기준 >95%`);
console.log(`  edge:         ${(cat.edge.accuracy * 100).toFixed(1)}% (${cat.edge.passed}/${cat.edge.total}) 기준 >90%`);

if (result.failures.length > 0) {
  console.log(`\n실패 샘플 (${result.failures.length}건): ${result.failures.join(', ')}`);
}

console.log(`\n게이트: ${result.gate_passed ? '✅ PASS' : '❌ FAIL'}`);
console.log(`리포트: ${REPORT_PATH}`);

if (!result.gate_passed) {
  process.exit(1);
}
