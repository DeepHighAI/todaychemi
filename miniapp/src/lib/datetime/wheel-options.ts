/**
 * wheel-options.ts — iOS 휠 피커 옵션·날짜시간 변환 (결정형, 단일 출처)
 *
 * 네이티브 <input type=date/time> 를 대체하는 휠 피커의 순수 로직.
 * 출력 문자열은 기존과 동일(YYYY-MM-DD / HH:MM)하게 유지해야 한다(불변).
 * UI/스타일/스크롤 동작은 컴포넌트가, 옵션·파싱·경계 보정은 본 모듈이 담당.
 */

export interface YMD {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export interface HM {
  hour: number; // 0-23
  minute: number; // 0-59
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** (year, month 1-12)의 일수. new Date(y, month, 0) = 해당 월 말일. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function yearOptions(minYear: number, maxYear: number): string[] {
  const out: string[] = [];
  for (let y = minYear; y <= maxYear; y++) out.push(String(y));
  return out;
}

export function monthOptions(): string[] {
  return Array.from({ length: 12 }, (_, i) => pad2(i + 1));
}

export function dayOptions(year: number, month: number): string[] {
  const n = daysInMonth(year, month);
  return Array.from({ length: n }, (_, i) => pad2(i + 1));
}

export function hourOptions(): string[] {
  return Array.from({ length: 24 }, (_, i) => pad2(i));
}

export function minuteOptions(): string[] {
  return Array.from({ length: 60 }, (_, i) => pad2(i));
}

export function formatDate({ year, month, day }: YMD): string {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

/** 'YYYY-MM-DD' → YMD. 형식/범위 위반은 null(빈 문자열 포함). */
export function parseDate(s: string): YMD | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function formatTime({ hour, minute }: HM): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** 'HH:MM' → HM. 형식/범위 위반은 null. */
export function parseTime(s: string): HM | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** 일자를 해당 월 일수로 보정(예: 평년 2/31 → 2/28). */
export function clampDay(ymd: YMD): YMD {
  const max = daysInMonth(ymd.year, ymd.month);
  return ymd.day > max ? { ...ymd, day: max } : ymd;
}

const ymdToNum = ({ year, month, day }: YMD): number => year * 10000 + month * 100 + day;

/** 날짜를 [min, max] 경계로 보정(미래 생일 등 차단 — 네이티브 min/max 검증 보존). */
export function clampDateToBounds(ymd: YMD, min: YMD, max: YMD): YMD {
  if (ymdToNum(ymd) < ymdToNum(min)) return min;
  if (ymdToNum(ymd) > ymdToNum(max)) return max;
  return ymd;
}
