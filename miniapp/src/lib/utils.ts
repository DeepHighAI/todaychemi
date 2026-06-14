/**
 * utils.ts — 공용 클래스명 헬퍼
 *
 * 웹앱의 cn(clsx + tailwind-merge) 대신 미니앱은 Tailwind가 없으므로
 * 단순 공백 조인 방식으로 대체한다.
 * 컴포넌트에서 import { cn } from '@/lib/utils' 패턴 유지.
 */

/** 클래스명 배열을 필터링해서 이어 붙인다 (falsy 값 제외) */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
