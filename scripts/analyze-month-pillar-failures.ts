// G0 게이트 月柱 불일치 근본 원인 분석 러너
// 실행: pnpm analyze-month-pillar

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KasiFixtureRecord } from '../src/lib/kasi/seed-runner';
import {
  analyzeRecord,
  buildSummary,
  buildMarkdownReport,
  type AnalysisSummary,
} from './lib/analysis-helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function main() {
  // ssaju는 ESM-only
  const { calculateSaju, solarToLunar, lunarToSolar } = await import('ssaju');

  // 픽스처 + 보고서 로딩
  const fixture: KasiFixtureRecord[] = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'tests/fixtures/kasi_reference_100.json'), 'utf-8'),
  );
  const report: { failures: string[] } = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'reports/kasi_verification_report.json'), 'utf-8'),
  );

  const failureSet = new Set(report.failures);
  const failedRecords = fixture.filter(r => failureSet.has(r.id));

  // ssaju 함수 주입
  const computeMonthFn = (y: number, m: number, d: number, h: number): string => {
    const result = calculateSaju({ year: y, month: m, day: d, hour: h, minute: 0, gender: '남', calendar: 'solar' });
    return result.pillars.month;
  };

  const getLunarMonthFn = (y: number, m: number, d: number): { lunarMonth: number; lunarMonthStartSolar: string } => {
    const lunar = solarToLunar(y, m, d);
    const startSolar = lunarToSolar(lunar.year, lunar.month, 1, false);
    const lunarMonthStartSolar = `${startSolar.year}-${String(startSolar.month).padStart(2, '0')}-${String(startSolar.day).padStart(2, '0')}`;
    return { lunarMonth: lunar.month, lunarMonthStartSolar };
  };

  console.log(`분석 시작: ${failedRecords.length}건 실패 레코드`);
  const details = failedRecords.map((record, i) => {
    if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${failedRecords.length}건 처리 중...\n`);
    return analyzeRecord(record, computeMonthFn, getLunarMonthFn);
  });

  const summary: AnalysisSummary = { ...buildSummary(details), details };

  // ssaju 버전
  const ssajuPkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'node_modules/ssaju/package.json'), 'utf-8'),
  ) as { version: string };

  const markdown = buildMarkdownReport(summary, ssajuPkg.version);

  const outPath = path.join(ROOT, 'reports/month_pillar_failure_analysis.md');
  fs.writeFileSync(outPath, markdown, 'utf-8');

  console.log(`✅ Analyzed ${details.length} failures → reports/month_pillar_failure_analysis.md`);
  console.log(`   solar_vs_lunar: ${summary.solarVsLunarCount}건 (${((summary.solarVsLunarCount / summary.totalFailures) * 100).toFixed(1)}%)`);
  console.log(`   >72h 버킷: ${summary.byProximityBucket['>72h']}건`);
  console.log(`   중앙 절기거리: ${summary.medianHoursFromTransition.toFixed(1)}h`);
}

main().catch(e => { console.error(e); process.exit(1); });
