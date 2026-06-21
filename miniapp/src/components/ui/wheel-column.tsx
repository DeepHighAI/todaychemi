/**
 * wheel-column.tsx — iOS 스타일 휠 컬럼 (단일 열)
 *
 * 와이어 ref: UIDesign/interactive.jsx WheelPicker + system.css .picker-col.
 * scroll-snap 으로 40px 항목을 중앙 밴드에 정렬한다. 스크롤(드래그)과
 * 항목 클릭 양쪽으로 선택할 수 있다(테스트/접근성은 클릭 경로 사용).
 * 중앙 밴드 오버레이는 상위(DateWheelField/TimeWheelField)가 그린다.
 */

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';

const ITEM_H = 40;
const COL_H = 180;
const PAD = (COL_H - ITEM_H) / 2; // 70 — 첫 항목 중앙이 밴드(50%)에 오도록

interface WheelColumnProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}

export function WheelColumn({ options, value, onChange, ariaLabel }: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const optId = (o: string) => `${baseId}-${o}`;

  // value/options 변경 시 선택 항목을 중앙으로 스크롤.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = options.indexOf(value);
    if (idx >= 0) el.scrollTop = idx * ITEM_H;
  }, [value, options]);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ITEM_H)));
    const next = options[idx];
    if (next !== undefined && next !== value) onChange(next);
  }

  // 키보드 조작(listbox 계약) — 네이티브 input 대체에 따른 a11y 보존.
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const cur = options.indexOf(value);
    let next = cur;
    switch (e.key) {
      case 'ArrowDown':
        next = Math.min(options.length - 1, cur + 1);
        break;
      case 'ArrowUp':
        next = Math.max(0, cur - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = options.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const v = options[next];
    if (v !== undefined && v !== value) onChange(v);
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      aria-activedescendant={options.includes(value) ? optId(value) : undefined}
      onKeyDown={handleKeyDown}
      className="wheel-col"
      onScroll={handleScroll}
      style={{
        height: COL_H,
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        padding: `${PAD}px 0`,
        textAlign: 'center',
      }}
    >
      {options.map((o) => {
        const selected = o === value;
        return (
          <div
            key={o}
            id={optId(o)}
            role="option"
            aria-selected={selected}
            onClick={() => onChange(o)}
            style={{
              height: ITEM_H,
              lineHeight: `${ITEM_H}px`,
              scrollSnapAlign: 'center',
              fontSize: 17,
              fontWeight: selected ? 800 : 600,
              color: selected ? 'var(--p-40)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {o}
          </div>
        );
      })}
    </div>
  );
}
