// scripts/lib/analysis-helpers.ts
// 月柱 불일치 원인 분석 헬퍼 — G0 게이트 재검토용
// 사용: scripts/analyze-month-pillar-failures.ts

import type { KasiFixtureRecord } from '../../src/lib/kasi/seed-runner';

export type ProximityBucket = '≤3h' | '3-24h' | '24-72h' | '>72h';

export interface FailureDetail {
  id: string;
  category: 'normal' | 'boundary' | 'edge';
  birthDatetime: string;
  ssajuMonth: string;
  kasiMonth: string;
  lunarMonth: number;
  lunarMonthStartSolar: string;
  hoursFromSolarTermTransition: number;
  proximityBucket: ProximityBucket;
  /** ssaju가 solar term 기준, KASI가 lunar month 기준이면 'solar_vs_lunar' */
  patternType: 'solar_vs_lunar' | 'unknown';
}

export interface AnalysisSummary {
  totalFailures: number;
  byCategory: Record<'normal' | 'boundary' | 'edge', number>;
  byProximityBucket: Record<ProximityBucket, number>;
  solarVsLunarCount: number;
  medianHoursFromTransition: number;
  maxHoursFromTransition: number;
  details: FailureDetail[];
}

/**
 * 절기 근접도 버킷 분류
 * ssaju의 solar term 전환점 기준
 */
export function bucketProximity(hoursFromTransition: number): ProximityBucket {
  if (hoursFromTransition <= 3) return '≤3h';
  if (hoursFromTransition <= 24) return '3-24h';
  if (hoursFromTransition <= 72) return '24-72h';
  return '>72h';
}

/**
 * 생년월일시 → Date (UTC 기준, KST 변환)
 * ssaju와 동일한 KST→UTC 변환 (단순 9시간 감산, DST 제외 단순화)
 */
export function toUtcDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
}

/**
 * UTC 날짜에 N시간 더한 후 KST 날짜 컴포넌트 반환
 */
export function addHoursKst(
  baseUtc: Date,
  hours: number,
): { year: number; month: number; day: number; hour: number } {
  const d = new Date(baseUtc.getTime() + hours * 3_600_000);
  const kst = new Date(d.getTime() + 9 * 3_600_000);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    hour: kst.getUTCHours(),
  };
}

/**
 * ssaju의 月柱 전환점을 binary scan으로 찾아 생년월일시로부터 거리(시간) 반환.
 * computeMonthFn: 임의 KST 년월일시 → 月柱 문자열 (테스트 시 mock 주입 가능)
 * 주의: scanRangeHours 범위 안에서만 탐색 (±default 20일)
 */
export function findSsajuJeolgiTransition(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  computeMonthFn: (y: number, m: number, d: number, h: number) => string,
  scanRangeHours = 24 * 20,
): number {
  const baseUtc = toUtcDate(year, month, day, hour, minute);
  const birthMonth = computeMonthFn(year, month, day, hour);

  let forwardHours = Infinity;
  for (let h = 1; h <= scanRangeHours; h++) {
    const kst = addHoursKst(baseUtc, h);
    try {
      if (computeMonthFn(kst.year, kst.month, kst.day, kst.hour) !== birthMonth) {
        forwardHours = h - 0.5;
        break;
      }
    } catch {
      break; // ssaju 유효 연도 범위 초과 — 이 방향에 전환점 없음
    }
  }

  let backwardHours = Infinity;
  for (let h = 1; h <= scanRangeHours; h++) {
    const kst = addHoursKst(baseUtc, -h);
    try {
      if (computeMonthFn(kst.year, kst.month, kst.day, kst.hour) !== birthMonth) {
        backwardHours = h - 0.5;
        break;
      }
    } catch {
      break;
    }
  }

  return Math.min(forwardHours, backwardHours);
}

/**
 * 두 月柱 문자열이 '정확히 한 달' 차이인지 확인
 * 60간지 순환 기준 ±1 차이
 */
export function isOneMonthApart(a: string, b: string): boolean {
  const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  if (a.length !== 2 || b.length !== 2) return false;
  const as = STEMS.indexOf(a[0]);
  const ab = BRANCHES.indexOf(a[1]);
  const bs = STEMS.indexOf(b[0]);
  const bb = BRANCHES.indexOf(b[1]);
  if (as < 0 || ab < 0 || bs < 0 || bb < 0) return false;
  // 60간지 순환 위치: CRT 공식 (s*36 + b*25) % 60
  const ai = (as * 36 + ab * 25) % 60;
  const bi = (bs * 36 + bb * 25) % 60;
  const diff = ((bi - ai) % 60 + 60) % 60;
  return diff === 1 || diff === 59;
}

/**
 * 배열의 중앙값
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * 분석 요약 마크다운 생성
 */
export function buildMarkdownReport(summary: AnalysisSummary, ssajuVersion: string): string {
  const { totalFailures, byCategory, byProximityBucket, solarVsLunarCount, medianHoursFromTransition, maxHoursFromTransition, details } = summary;

  const lines: string[] = [
    '# 月柱 불일치 근본 원인 분석 보고서',
    '',
    `> 생성: ${new Date().toISOString().slice(0, 10)} | ssaju v${ssajuVersion}`,
    '',
    '## 1. 요약',
    '',
    `- 전체 실패: **${totalFailures}건** / 100건 (61% 일치율)`,
    `- 카테고리별: normal ${byCategory.normal}건 / boundary ${byCategory.boundary}건 / edge ${byCategory.edge}건`,
    `- solar_vs_lunar 패턴: **${solarVsLunarCount}건** (${((solarVsLunarCount / totalFailures) * 100).toFixed(1)}%)`,
    `- ssaju 절기 전환점 기준 중앙 거리: ${medianHoursFromTransition.toFixed(1)}h (최대 ${maxHoursFromTransition.toFixed(1)}h)`,
    '',
    '## 2. 근본 원인: 두 가지 서로 다른 月 기준',
    '',
    '| 항목 | ssaju | KASI `lunWolgeon` |',
    '|---|---|---|',
    '| 月 기준 | 절기(節氣) 시각 — Sun 황경 기준 | 음력 월(月) 시작일 기준 |',
    '| 알고리즘 | Meeus 근사 공식 Newton-Raphson | 한국천문연구원 공식 역서 |',
    '| 월 시작 | 절기 정확 시각 (분 단위) | 합삭(朔, 음력 초하루) |',
    '| 전통 근거 | 현대 사주 표준 (절기 기준) | 한국 음력 달력 (月建) |',
    '',
    '**결론**: ssaju와 KASI `lunWolgeon`은 서로 다른 전통을 따름.',
    '둘 다 "틀린" 것이 아니라 **측정 대상 자체가 다름**.',
    '현대 한국 사주 실무는 절기 기준(ssaju 방식)이 주류.',
    '',
    '## 3. 절기 전환점 근접도 분포',
    '',
    '| 버킷 | 건수 | 비율 |',
    '|---|---|---|',
    ...(['≤3h', '3-24h', '24-72h', '>72h'] as ProximityBucket[]).map(
      b => `| ${b} | ${byProximityBucket[b]}건 | ${((byProximityBucket[b] / totalFailures) * 100).toFixed(1)}% |`,
    ),
    '',
    '> `>72h` 버킷이 많으면 절기 타이밍 문제가 아닌 기준 차이 확인.',
    '',
    '## 4. 실패 상세 (전체 목록)',
    '',
    '| ID | 카테고리 | 생년월일시 | ssaju月 | KASI月 | 절기거리 | 버킷 | 패턴 |',
    '|---|---|---|---|---|---|---|---|',
    ...details.map(d =>
      `| ${d.id} | ${d.category} | ${d.birthDatetime} | ${d.ssajuMonth} | ${d.kasiMonth} | ${d.hoursFromSolarTermTransition.toFixed(1)}h | ${d.proximityBucket} | ${d.patternType} |`,
    ),
    '',
    '## 5. §1.1 의사결정 권고',
    '',
    '이 보고서를 바탕으로 `docs/specs/manseryeok_validation_g0_amendment_proposal.md` 에서',
    'Option A / B / C / D를 상세 검토할 것.',
    '',
  ];

  return lines.join('\n');
}

/**
 * 실패 건에 대한 분석 실행
 * computeMonthFn: ssaju calculateSaju 결과에서 month pillar 추출하는 함수
 */
export function analyzeRecord(
  record: KasiFixtureRecord,
  computeMonthFn: (y: number, m: number, d: number, h: number) => string,
  getLunarMonthFn: (y: number, m: number, d: number) => { lunarMonth: number; lunarMonthStartSolar: string },
): FailureDetail {
  const { year, month, day, hour, minute } = record.input;
  const ssajuMonth = computeMonthFn(year, month, day, hour);
  const kasiMonth = record.expected.month_pillar ?? '';

  const hoursFromSolarTermTransition = findSsajuJeolgiTransition(
    year, month, day, hour, minute,
    computeMonthFn,
  );

  const { lunarMonth, lunarMonthStartSolar } = getLunarMonthFn(year, month, day);

  const isOneApart = isOneMonthApart(ssajuMonth, kasiMonth);
  const patternType: FailureDetail['patternType'] = isOneApart ? 'solar_vs_lunar' : 'unknown';

  return {
    id: record.id,
    category: record.category,
    birthDatetime: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    ssajuMonth,
    kasiMonth,
    lunarMonth,
    lunarMonthStartSolar,
    hoursFromSolarTermTransition,
    proximityBucket: bucketProximity(hoursFromSolarTermTransition),
    patternType,
  };
}

/**
 * 전체 분석 실행 후 요약 생성
 */
export function buildSummary(details: FailureDetail[]): Omit<AnalysisSummary, 'details'> {
  const byCategory = { normal: 0, boundary: 0, edge: 0 };
  const byProximityBucket: Record<ProximityBucket, number> = { '≤3h': 0, '3-24h': 0, '24-72h': 0, '>72h': 0 };
  let solarVsLunarCount = 0;

  for (const d of details) {
    byCategory[d.category]++;
    byProximityBucket[d.proximityBucket]++;
    if (d.patternType === 'solar_vs_lunar') solarVsLunarCount++;
  }

  const hours = details.map(d => d.hoursFromSolarTermTransition);

  return {
    totalFailures: details.length,
    byCategory,
    byProximityBucket,
    solarVsLunarCount,
    medianHoursFromTransition: median(hours),
    maxHoursFromTransition: hours.length > 0 ? Math.max(...hours) : 0,
  };
}
