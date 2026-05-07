import type { ChartCore } from '@/types/chart';
import { STEM_ELEMENT } from '@/lib/kasi/constants';

export interface RawFixtureInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  gender: string;
  calendar: string;
}

export interface RawFixtureExpected {
  year_pillar: string;
  month_pillar: string;
  day_pillar: string;
  hour_pillar: string;
  day_master_stem: string;
  five_elements_counts: Record<'목' | '화' | '토' | '금' | '수', number>;
  source: string;
}

export interface RawFixtureEntry {
  id: string;
  category: string;
  input: RawFixtureInput;
  expected: RawFixtureExpected;
}

export function loadFixtureChart(entry: RawFixtureEntry): ChartCore {
  const stem = entry.expected.day_master_stem;
  return {
    year_pillar: entry.expected.year_pillar,
    month_pillar: entry.expected.month_pillar,
    day_pillar: entry.expected.day_pillar,
    hour_pillar: entry.expected.hour_pillar,
    day_master_element: STEM_ELEMENT[stem]!,
    five_elements_counts: entry.expected.five_elements_counts,
    gender_normalized: entry.input.gender === '남' ? 'M' : 'F',
    yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
  };
}
