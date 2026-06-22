/**
 * seg.tsx — 공용 세그먼티드/토글 컨트롤 (Phase 6 드리프트 통합)
 *
 * 미니앱 곳곳의 단일선택 pill 컨트롤(Feed 필터·Hapcard 확장 탭·온보딩/인연/me-edit
 * 달력·성별·시간정확도)이 제각각 raw <button> + active 클래스로 구현돼 a11y(role/
 * aria-checked/키보드)가 불균일했다. 이 하나의 Seg 로 통합한다.
 *
 *  - variant="segment": 떠있는 pill 트랙(UIDesign .seg) — Feed 필터, Hapcard 탭.
 *  - variant="fill":    채움형 p-40 토글(온보딩·인연·me-edit) — 룩 유지.
 *
 * 컨트롤드 전용(value + onChange). role 기본 radiogroup(탭이면 tablist).
 * 로빙 tabindex + 화살표/Home/End 키보드(기존 컨트롤엔 전무하던 a11y 보강).
 */

import { useRef, type ReactNode } from 'react';

export interface SegOption<T extends string> {
  value: T;
  label: string;
  /** 라벨 앞 아이콘(선택) */
  icon?: ReactNode;
}

interface SegProps<T extends string> {
  options: readonly SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 'segment'(떠있는 pill 트랙) | 'fill'(채움형 p-40). 기본 'segment'. */
  variant?: 'segment' | 'fill';
  /** 컨테이너 접근성 라벨 */
  ariaLabel?: string;
  /** 'radiogroup'(기본) | 'tablist'(Hapcard 탭) */
  role?: 'radiogroup' | 'tablist';
  /** segment: 컨테이너 가로 스크롤(Feed 7옵션) */
  scrollable?: boolean;
  /** fill: 그리드 컬럼 수(2/3). 생략 시 flex 균등 행 */
  columns?: number;
  /** 폰트 스케일. 'md'(기본) | 'sm' */
  size?: 'sm' | 'md';
  /** segment 보라 액티브(UIDesign .itabs 레시피: 트랙 --surface-1, 활성 텍스트 --p-40/800).
   *  Hapcard in-result 탭용. 기본 false = .seg 레시피(트랙 --surface-2, 활성 --on-surface). */
  accent?: boolean;
  /** fill 아이템 반경. 'pill'(--r-pill, 달력/성별) | 'rounded'(--r-sm, 정확도). 기본 'pill' */
  shape?: 'pill' | 'rounded';
  /** fill 비활성 외곽선 스타일(정확도 선택지): --surface-1 + 1px border */
  outlined?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
  variant = 'segment',
  ariaLabel,
  role = 'radiogroup',
  scrollable = false,
  columns,
  size = 'md',
  accent = false,
  shape = 'pill',
  outlined = false,
  className,
  style,
}: SegProps<T>) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const itemRole = role === 'tablist' ? 'tab' : 'radio';
  const activeIndex = options.findIndex((o) => o.value === value);

  // 인덱스로 선택 이동(순환) + 해당 아이템 포커스(로빙 tabindex)
  function selectIndex(i: number) {
    const n = options.length;
    if (n === 0) return;
    const idx = ((i % n) + n) % n;
    onChange(options[idx].value);
    itemRefs.current[idx]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        selectIndex(activeIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        selectIndex(activeIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        selectIndex(0);
        break;
      case 'End':
        e.preventDefault();
        selectIndex(options.length - 1);
        break;
    }
  }

  const containerStyle: React.CSSProperties =
    variant === 'segment'
      ? {
          display: 'flex',
          gap: 2,
          padding: 3,
          background: accent ? 'var(--surface-1)' : 'var(--surface-2)',
          borderRadius: 'var(--r-md)',
          ...(scrollable ? { overflowX: 'auto', WebkitOverflowScrolling: 'touch' } : {}),
        }
      : {
          display: columns ? 'grid' : 'flex',
          ...(columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : {}),
          gap: 8,
        };

  const fontSize =
    variant === 'segment' ? (size === 'sm' ? 12 : 13) : size === 'sm' ? 12 : 14;

  function itemStyle(active: boolean): React.CSSProperties {
    if (variant === 'segment') {
      return {
        flex: scrollable ? '0 0 88px' : 1,
        minWidth: scrollable ? 88 : undefined,
        whiteSpace: 'nowrap',
        border: 'none',
        cursor: 'pointer',
        padding: '10px 4px',
        borderRadius: 12,
        fontSize,
        fontWeight: accent && active ? 800 : 600,
        backgroundColor: active ? 'var(--surface)' : 'transparent',
        color: active ? (accent ? 'var(--p-40)' : 'var(--on-surface)') : 'var(--on-surface-var)',
        boxShadow: active ? 'var(--e-1)' : 'none',
        transition: 'background-color 0.15s, color 0.15s',
      };
    }
    return {
      flex: columns ? undefined : 1,
      cursor: 'pointer',
      padding: '12px 8px',
      borderRadius: shape === 'rounded' ? 'var(--r-sm)' : 'var(--r-pill)',
      fontSize,
      fontWeight: 600,
      backgroundColor: active ? 'var(--p-40)' : outlined ? 'var(--surface-1)' : 'var(--surface-2)',
      color: active ? '#ffffff' : 'var(--foreground)',
      border: active ? 'none' : outlined ? '1px solid var(--border)' : 'none',
      transition: 'background-color 0.15s, color 0.15s',
    };
  }

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={className}
      style={{ ...containerStyle, ...style }}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        const ariaProps =
          itemRole === 'radio' ? { 'aria-checked': active } : { 'aria-selected': active };
        return (
          <button
            key={o.value}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            role={itemRole}
            {...ariaProps}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              ...itemStyle(active),
            }}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
