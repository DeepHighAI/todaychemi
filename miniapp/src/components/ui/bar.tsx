/**
 * bar.tsx — 수평 fill 바 공용 프리미티브 (Phase 4 데이터 비주얼 통일)
 *
 * 흩어져 있던 수평 막대(합카드 영역별 온도 · 합카드 오행 비교)를 하나의
 * 트랙+fill 규칙으로 통일한다. 색·임계값 판정은 호출부가 결정하고(value→color),
 * 본 프리미티브는 트랙/채움/정렬/접근성만 담당하는 dumb 프리미티브다.
 *
 * 세로 막대(timeline SVG · talisman 스파크라인)·진행바는 형태가 본질적으로
 * 달라 통일 대상이 아니다(과설계 회피, §1.1 2026-06-21).
 *
 * 트랙 크기는 호출부가 flex / width 로 제어한다(예: style={{ flex: 1 }}).
 */

import type { CSSProperties } from 'react';

interface BarProps {
  /** 현재 값 */
  value: number;
  /** 최대값(기본 100). 0 이하면 1 로 보정해 NaN 을 막는다. */
  max?: number;
  /** 채움 색(CSS 변수 권장) */
  color: string;
  /** 트랙(배경) 색 — 기본 --hairline. 카드(--bg-card) 위에서 라이트/다크 모두 가시.
   *  (--surface-1 은 다크에서 --bg-card 와 거의 동색이라 트랙이 안 보임) */
  trackColor?: string;
  /** 트랙 높이 px(기본 6) */
  height?: number;
  /** 채움 정렬 — 'end' 는 우측 정렬(비교 바 좌측 칸이 중앙으로 자라는 용도) */
  anchor?: 'start' | 'end';
  /**
   * 접근성 라벨 — 지정 시 채움 요소에 role=progressbar + aria-* 를 부여한다.
   * 미지정이면 순수 장식(부모가 의미를 제공).
   */
  ariaLabel?: string;
  /** 트랙(루트) 인라인 스타일 오버라이드 — flex/width 등 레이아웃 제어용 */
  style?: CSSProperties;
}

const TRACK_RADIUS = 'var(--r-pill)';

export function Bar({
  value,
  max = 100,
  color,
  trackColor = 'var(--hairline)',
  height = 6,
  anchor = 'start',
  ariaLabel,
  style,
}: BarProps) {
  // 0 이하 max 는 1 로 보정 → 0 분모 방지. pct 는 [0,100] 클램프.
  const safeMax = max <= 0 ? 1 : max;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));

  const a11y = ariaLabel
    ? {
        role: 'progressbar' as const,
        'aria-label': ariaLabel,
        'aria-valuenow': value,
        'aria-valuemin': 0,
        'aria-valuemax': safeMax,
      }
    : {};

  return (
    <span
      style={{
        display: 'block',
        height,
        backgroundColor: trackColor,
        borderRadius: TRACK_RADIUS,
        overflow: 'hidden',
        ...style,
      }}
    >
      <span
        {...a11y}
        style={{
          display: 'block',
          height: '100%',
          width: `${pct}%`,
          borderRadius: TRACK_RADIUS,
          backgroundColor: color,
          marginLeft: anchor === 'end' ? 'auto' : undefined,
        }}
      />
    </span>
  );
}
