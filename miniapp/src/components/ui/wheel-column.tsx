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
// 스크롤 정지(rest) 판정 대기. 마지막 scroll 프레임(=snap settle) 이후 이만큼 더 조용하면 rest 로 본다.
const SETTLE_MS = 90;

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

  // 디바운스 타이머 클로저의 stale value 비교를 막기 위해 최신 value 를 ref 로 노출.
  const valueRef = useRef(value);
  valueRef.current = value;
  // 정지(rest) 판정 타이머.
  const settleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // value/options 변경 시 선택 항목을 중앙으로 정렬. onChange 가 rest 에서만 발화하도록 디바운스됐으니
  // 이 effect 는 사용자 스크롤 중에는 실행되지 않는다(value 불변). 따라서 즉시 scrollTop 쓰기가
  // 더는 momentum/snap 과 충돌하지 않는다(기존 jank 원인 제거). rest 확정·클릭·키보드·초기 렌더에서만 정렬.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = options.indexOf(value);
    if (idx >= 0) el.scrollTop = idx * ITEM_H;
  }, [value, options]);

  // 언마운트 시 settle 타이머 정리.
  useEffect(() => () => clearTimeout(settleRef.current), []);

  // 정지 후 1회 — 스냅된 위치의 항목으로 확정.
  function commitFromScroll() {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ITEM_H)));
    const next = options[idx];
    if (next !== undefined && next !== valueRef.current) onChange(next);
  }

  // 스크롤(드래그/플릭) 중에는 onChange 를 발화하지 않고, 정지(snap settle) 후 1회만 발화한다.
  // 기존엔 매 스크롤 프레임마다 onChange → 부모 리렌더가 native snap 애니메이션과 충돌해
  // 스크롤이 끊기고 튀었다(부자연스러움의 주원인). settle 타이머로 rest 에서만 확정한다.
  function handleScroll() {
    clearTimeout(settleRef.current);
    settleRef.current = setTimeout(commitFromScroll, SETTLE_MS);
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
        // iOS WebView momentum + 트레이 밖으로 스크롤 체이닝 방지(휠을 끝까지 넘겨도 페이지가 안 밀림).
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
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
              // 빠른 플릭이 여러 칸 미끄러지지 않고 한 칸씩 멈추게(iOS 휠 느낌·통제감).
              scrollSnapStop: 'always',
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
