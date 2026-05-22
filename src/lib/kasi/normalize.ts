import { calculateSaju } from 'ssaju';
import type { KasiLunCalItem } from './types';
import {
  HEAVENLY_STEMS, EARTHLY_BRANCHES,
  STEM_ELEMENT, BRANCH_ELEMENT,
  hourToBranchIndex, HOUR_STEM_BASE,
  type Element,
} from './constants';
import type { ChartCore, YunseCore } from '@/types/chart';

function formatKstDate(now: Date): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function mapSsajuToYunse(sajuResult: ReturnType<typeof calculateSaju>, now: Date): YunseCore {
  const daeunCurrent = sajuResult.daeun.current;
  return {
    daeun: {
      start_age: sajuResult.daeun.startAge,
      list: sajuResult.daeun.list.map(d => ({ age: d.startAge, pillar: d.ganzhi, year: d.startYear })),
      current_index: daeunCurrent
        ? Math.max(0, sajuResult.daeun.list.findIndex(
            d => d.startAge === daeunCurrent.startAge && d.startYear === daeunCurrent.startYear,
          ))
        : 0,
    },
    seyun: {
      current_pillar: sajuResult.reference.codes.thisYear,
      current_year: sajuResult.currentYear,
    },
    wolun: {
      current_pillar: sajuResult.reference.codes.thisMonth,
      current_month: formatKstDate(now).slice(0, 7),
    },
    iliun: {
      today_pillar: sajuResult.reference.codes.today,
      today_date: formatKstDate(now),
    },
  };
}

type Gender = 'M' | 'F';

// 실제 KASI 응답은 "경인(庚寅)" 형식이므로 괄호 안 한자를 추출
function extractHanja(str: string): string {
  const m = str.match(/\(([^)]+)\)/);
  return m ? m[1] : str;
}

function buildPillar(stemIdx: number, branchIdx: number): string {
  return HEAVENLY_STEMS[stemIdx] + EARTHLY_BRANCHES[branchIdx];
}

function computeHourPillar(dayStem: string, timeStr: string): string {
  const hour = parseInt(timeStr.split(':')[0], 10);
  const branchIdx = hourToBranchIndex(hour);
  // ADR-037 §1.1 결정 (2026-05-03): 야자시 어드밴스 제거 — ssaju 동일 기준 (조자시 통합 학파)
  const stemBase = HOUR_STEM_BASE[dayStem as keyof typeof HOUR_STEM_BASE] ?? 0;
  const stemIdx = (stemBase + branchIdx) % 10;
  return buildPillar(stemIdx, branchIdx);
}

function pillarElements(pillar: string): Element[] {
  const elements: Element[] = [];
  const stem = STEM_ELEMENT[pillar[0]];
  const branch = BRANCH_ELEMENT[pillar[1]];
  if (stem) elements.push(stem);
  if (branch) elements.push(branch);
  return elements;
}

function countElements(pillars: (string | null)[]): Record<Element, number> {
  const counts: Record<Element, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const p of pillars) {
    if (!p) continue;
    for (const el of pillarElements(p)) {
      counts[el]++;
    }
  }
  return counts;
}

export interface BirthInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  calendar: 'solar' | 'lunar';
  leap?: boolean;
}

export function normalizeKasiToChartCore(
  item: KasiLunCalItem,
  gender: Gender,
  timeStr: string | null,
  birthInput: BirthInput,
): ChartCore {
  const day_pillar = extractHanja(item.lunIljin);
  const dayStem = day_pillar[0];

  // ADR-037 §1.1 결정 (2026-05-03): ssaju가 年/月柱(절기 기준) 프로덕션 source
  // KASI lunSecha(합삭 기준)·lunWolgeon(음력 月建)은 사주 기준과 다르므로 사용하지 않는다
  const now = new Date();
  const sajuResult = calculateSaju({
    year: birthInput.year,
    month: birthInput.month,
    day: birthInput.day,
    hour: birthInput.hour,
    minute: birthInput.minute,
    gender: gender === 'M' ? '남' : '여',
    calendar: birthInput.calendar,
    leap: birthInput.leap,
    now,
  });
  const year_pillar = sajuResult.pillars.year;
  const month_pillar = sajuResult.pillars.month;

  const hour_pillar = timeStr ? computeHourPillar(dayStem, timeStr) : null;

  const day_master_element = STEM_ELEMENT[dayStem] ?? '목';
  const five_elements_counts = countElements([year_pillar, month_pillar, day_pillar, hour_pillar]);

  return {
    year_pillar,
    month_pillar,
    day_pillar,
    hour_pillar,
    day_master_element,
    five_elements_counts,
    gender_normalized: gender,
    yunse: mapSsajuToYunse(sajuResult, now),
  };
}
