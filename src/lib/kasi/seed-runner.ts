import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { normalizeKasiToChartCore, type BirthInput } from './normalize';
import type { KasiLunCalItem } from './types';
import type { Element } from './constants';

export type SeedCategory = 'normal' | 'boundary' | 'edge';
export type SeedGender = '남' | '여';
export type SeedCalendar = 'solar' | 'lunar';

export interface SeedInput {
  id: string;
  category: SeedCategory;
  input: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    gender: SeedGender;
    calendar: SeedCalendar;
    leap?: boolean;
  };
}

export interface KasiFixtureRecord {
  id: string;
  category: SeedCategory;
  input: SeedInput['input'];
  expected: {
    year_pillar: string;
    month_pillar: string | null;
    day_pillar: string;
    hour_pillar: string | null;
    day_master_stem: string;
    five_elements_counts: Record<string, number>;
    source: 'kasi_authoritative';
  };
}

export interface BuildKasiFixturesOptions {
  fetchSolar: (year: number, month: number, day: number) => Promise<KasiLunCalItem>;
  lunarToSolar: (lunYear: number, lunMonth: number, lunDay: number, isLeap?: boolean) => Promise<{ year: number; month: number; day: number }>;
  partialPath?: string;
}

function buildRecord(input: SeedInput, item: KasiLunCalItem): KasiFixtureRecord {
  const gender: 'M' | 'F' = input.input.gender === '남' ? 'M' : 'F';
  const hour = input.input.hour;
  const minute = input.input.minute;
  const timeStr = (hour != null && !isNaN(hour))
    ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    : null;

  const birthInput: BirthInput = {
    year: input.input.year,
    month: input.input.month,
    day: input.input.day,
    hour: hour ?? 0,
    minute: minute ?? 0,
    calendar: input.input.calendar,
    leap: input.input.leap,
  };

  const core = normalizeKasiToChartCore(item, gender, timeStr, birthInput);
  return {
    id: input.id,
    category: input.category,
    input: input.input,
    expected: {
      year_pillar: core.year_pillar,
      month_pillar: core.month_pillar,
      day_pillar: core.day_pillar,
      hour_pillar: core.hour_pillar,
      day_master_stem: core.day_pillar[0],
      five_elements_counts: core.five_elements_counts as Record<string, number>,
      source: 'kasi_authoritative',
    },
  };
}

export async function buildKasiFixtures(
  inputs: SeedInput[],
  options: BuildKasiFixturesOptions,
): Promise<{ records: KasiFixtureRecord[]; failures: string[] }> {
  const { fetchSolar, lunarToSolar, partialPath } = options;

  // 이미 완료된 레코드 로드 (재시도 시 재사용)
  const completed = new Map<string, KasiFixtureRecord>();
  if (partialPath && existsSync(partialPath)) {
    const saved: KasiFixtureRecord[] = JSON.parse(readFileSync(partialPath, 'utf-8'));
    for (const r of saved) completed.set(r.id, r);
  }

  const records: KasiFixtureRecord[] = [];
  const failures: string[] = [];

  for (const input of inputs) {
    // 부분 진행 캐시 활용
    const cached = completed.get(input.id);
    if (cached) {
      records.push(cached);
      continue;
    }

    try {
      let solYear = input.input.year;
      let solMonth = input.input.month;
      let solDay = input.input.day;

      if (input.input.calendar === 'lunar') {
        const sol = await lunarToSolar(
          input.input.year,
          input.input.month,
          input.input.day,
          input.input.leap ?? false,
        );
        solYear = sol.year;
        solMonth = sol.month;
        solDay = sol.day;
      }

      const item = await fetchSolar(solYear, solMonth, solDay);
      const record = buildRecord(input, item);
      records.push(record);

      // 부분 진행 저장
      if (partialPath) {
        const all = [...completed.values(), ...records];
        writeFileSync(partialPath, JSON.stringify(all, null, 2), 'utf-8');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`WARN: ${input.id} failed: ${msg}`);
      failures.push(input.id);
    }
  }

  return { records, failures };
}
