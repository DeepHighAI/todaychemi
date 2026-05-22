import { calculateSaju } from 'ssaju';
import type { BirthCalendar, BirthTimeKnowledge, Gender } from '@/types/relation';
import type { ChartCore, YunseCore } from '@/types/chart';
import { mapSsajuToYunse } from '@/lib/kasi/normalize';

const TARGET_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ChartBirthForYunse {
  birth_date: string;
  birth_date_calendar: BirthCalendar;
  is_lunar_leap: boolean;
  birth_time_knowledge: BirthTimeKnowledge;
  birth_time: string | null;
  gender: Gender;
}

export function kstDateToReferenceDate(targetDate: string): Date {
  if (!TARGET_DATE_RE.test(targetDate)) {
    throw new Error(`INVALID_TARGET_DATE: ${targetDate}`);
  }
  return new Date(`${targetDate}T12:00:00+09:00`);
}

export function computeYunseAtDate(
  birth: ChartBirthForYunse,
  targetDate: string,
): YunseCore {
  const [year, month, day] = birth.birth_date.split('-').map(Number);
  const effectiveTime =
    birth.birth_time_knowledge === 'unknown' ? null : birth.birth_time;
  const hour = effectiveTime ? parseInt(effectiveTime.split(':')[0], 10) : 12;
  const minute = effectiveTime ? parseInt(effectiveTime.split(':')[1], 10) : 0;
  const now = kstDateToReferenceDate(targetDate);

  const sajuResult = calculateSaju({
    year,
    month,
    day,
    hour,
    minute,
    gender: birth.gender === 'M' ? '남' : '여',
    calendar: birth.birth_date_calendar,
    leap: birth.is_lunar_leap,
    now,
  });

  return mapSsajuToYunse(sajuResult, now);
}

export function withYunseAtDate(
  chart: ChartCore,
  birth: ChartBirthForYunse,
  targetDate: string,
): ChartCore {
  return {
    ...chart,
    yunse: computeYunseAtDate(birth, targetDate),
  };
}
