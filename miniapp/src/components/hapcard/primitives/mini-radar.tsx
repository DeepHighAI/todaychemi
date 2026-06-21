/**
 * mini-radar.tsx — 오행 오버레이 레이더 (본인 vs 인연, 미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/primitives/mini-radar.tsx (read-only ref)
 * 미니앱 적응:
 *   - hsl(var(--primary)) → var(--primary)(미니앱 토큰은 hex)
 *   - currentColor 그리드/축 → --hairline(다크 패리티 토큰)
 *   - Tailwind 클래스 → 인라인 스타일
 *   - 한글 원소 라벨만(ADR-038), 5축 목화토금수.
 */

import { toPercent } from '@/lib/hapcard/ohaeng-percent';
import type { OhaengElement } from '@/lib/saju/elementLabel';

const ELEMENTS: OhaengElement[] = ['목', '화', '토', '금', '수'];
const N = ELEMENTS.length;
const CX = 100;
const CY = 100;
const R_MAX = 70;
const LABEL_OFFSET = 12;
const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

function vertex(index: number, scale: number): [number, number] {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / N;
  return [CX + scale * R_MAX * Math.cos(angle), CY + scale * R_MAX * Math.sin(angle)];
}

function polygonPoints(percents: Record<OhaengElement, number>): string {
  return ELEMENTS.map((el, i) => {
    const [x, y] = vertex(i, (percents[el] ?? 0) / 100);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

function gridPolygon(level: number): string {
  return ELEMENTS.map((_, i) => {
    const [x, y] = vertex(i, level);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

interface MiniRadarProps {
  user: Record<OhaengElement, number>;
  relation: Record<OhaengElement, number>;
}

export function MiniRadar({ user, relation }: MiniRadarProps) {
  const userPct = toPercent(user);
  const relPct = toPercent(relation);

  return (
    <svg role="img" aria-label="오행 비교 오각형" viewBox="0 0 200 200" style={{ width: '100%', height: 'auto' }}>
      {GRID_LEVELS.map((lv) => (
        <polygon key={lv} points={gridPolygon(lv)} fill="none" stroke="var(--hairline)" strokeWidth={1} />
      ))}
      {ELEMENTS.map((_, i) => {
        const [x, y] = vertex(i, 1);
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={x.toFixed(2)}
            y2={y.toFixed(2)}
            stroke="var(--hairline)"
            strokeWidth={1}
          />
        );
      })}
      <polygon
        data-series="relation"
        points={polygonPoints(relPct)}
        fill="none"
        stroke="var(--text-secondary)"
        strokeWidth={1.5}
        strokeDasharray="3 2"
      />
      <polygon
        data-series="user"
        points={polygonPoints(userPct)}
        fill="var(--primary)"
        fillOpacity={0.35}
        stroke="var(--primary)"
        strokeWidth={1.5}
      />
      {ELEMENTS.map((el, i) => {
        const [x, y] = vertex(i, 1 + LABEL_OFFSET / R_MAX);
        return (
          <text
            key={el}
            x={x.toFixed(2)}
            y={y.toFixed(2)}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 10, fontWeight: 500, fill: 'var(--text-secondary)' }}
          >
            {el}
          </text>
        );
      })}
    </svg>
  );
}
