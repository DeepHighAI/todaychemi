import { lunarToSolar } from 'ssaju';
import { fetchLunCalInfo } from '@/lib/kasi/client';
import { normalizeKasiToChartCore, type BirthInput } from '@/lib/kasi/normalize';
import { DEFAULT_BIRTH_LONGITUDE } from '@/lib/kasi/constants';
import { deriveChartHash } from './chart-hash';
import type { ChartCore } from '@/types/chart';

export interface ComputeInput {
  entity_id: string;
  birth_date: string;               // YYYY-MM-DD
  birth_date_calendar: 'solar' | 'lunar';
  is_lunar_leap: boolean;
  birth_time_knowledge: 'exact' | 'approximate' | 'unknown';
  birth_time: string | null;        // HH:mm or HH:mm:ss
  gender: 'M' | 'F';
  // 출생 경도 — 시주 진태양시 보정용 (ADR-021 Amended). null/미지정 = 서울(126.978) 가정.
  birth_longitude?: number | null;
  theory_profile_version: string;
}

export interface ComputeResult {
  chart_core: ChartCore;
  chart_hash: string;
}

export async function computeChart(input: ComputeInput, serviceKey: string): Promise<ComputeResult> {
  const [year, month, day] = input.birth_date.split('-').map(Number);

  // KASI는 양력 날짜 필요 — 음력이면 변환
  let solYear = year, solMonth = month, solDay = day;
  if (input.birth_date_calendar === 'lunar') {
    const sol = lunarToSolar(year, month, day, input.is_lunar_leap);
    solYear = sol.year;
    solMonth = sol.month;
    solDay = sol.day;
  }

  const kasiItem = await fetchLunCalInfo(solYear, solMonth, solDay, serviceKey);

  // birth_time_knowledge='unknown' → 시주 없음 (hour_pillar=null), ssaju에는 12:00 가정
  const effectiveTimeStr =
    input.birth_time_knowledge === 'unknown' ? null : (input.birth_time ?? null);
  const hour = effectiveTimeStr ? parseInt(effectiveTimeStr.split(':')[0], 10) : 12;
  const minute = effectiveTimeStr ? parseInt(effectiveTimeStr.split(':')[1], 10) : 0;

  const birthInput: BirthInput = {
    year,
    month,
    day,
    hour,
    minute,
    calendar: input.birth_date_calendar,
    leap: input.is_lunar_leap,
  };

  // 시주 진태양시 보정 컨텍스트 — 균시차는 양력 날짜 기준 (음력 입력은 위에서 변환 완료)
  const effectiveLongitude = input.birth_longitude ?? DEFAULT_BIRTH_LONGITUDE;
  const chart_core = normalizeKasiToChartCore(kasiItem, input.gender, effectiveTimeStr, birthInput, {
    birth_longitude: effectiveLongitude,
    solar_date: { year: solYear, month: solMonth, day: solDay },
  });
  const chart_hash = deriveChartHash({
    entity_id: input.entity_id,
    birth_date: input.birth_date,
    birth_date_calendar: input.birth_date_calendar,
    is_lunar_leap: input.is_lunar_leap,
    effective_birth_time: effectiveTimeStr,
    gender: input.gender,
    birth_longitude: effectiveLongitude,
    theory_profile_version: input.theory_profile_version,
  });

  return { chart_core, chart_hash };
}
