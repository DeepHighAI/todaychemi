/**
 * kst-date.ts — KST 기준 날짜 문자열 유틸 (웹앱과 동일, next/* 없음)
 *
 * 웹앱 원본: src/lib/today/kst-date.ts (read-only reference)
 */

export function todayKST(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

export function yesterdayKST(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000 - 86400 * 1000);
  return now.toISOString().slice(0, 10);
}
