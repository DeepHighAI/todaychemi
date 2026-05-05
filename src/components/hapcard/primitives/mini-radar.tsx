import { toPercent } from '@/lib/hapcard/ohaeng-percent';

type OhaengKey = '목' | '화' | '토' | '금' | '수';

const ELEMENTS: OhaengKey[] = ['목', '화', '토', '금', '수'];
const N = ELEMENTS.length;
const CX = 100;
const CY = 100;
const R_MAX = 70;
const LABEL_OFFSET = 12;

function vertex(index: number, scale: number): [number, number] {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / N;
  return [
    CX + scale * R_MAX * Math.cos(angle),
    CY + scale * R_MAX * Math.sin(angle),
  ];
}

function polygonPoints(percents: Record<OhaengKey, number>): string {
  return ELEMENTS.map((el, i) => {
    const [x, y] = vertex(i, (percents[el] ?? 0) / 100);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

function gridPolygon(level: number): string {
  return ELEMENTS.map((_, i) => {
    const [x, y] = vertex(i, level);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

interface MiniRadarProps {
  user: Record<OhaengKey, number>;
  relation: Record<OhaengKey, number>;
}

export function MiniRadar({ user, relation }: MiniRadarProps) {
  const userPct = toPercent(user);
  const relPct = toPercent(relation);

  return (
    <svg
      role="img"
      aria-label="오행 비교 오각형"
      viewBox="0 0 200 200"
      className="w-full h-auto"
    >
      {GRID_LEVELS.map((lv) => (
        <polygon
          key={lv}
          points={gridPolygon(lv)}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeWidth="1"
        />
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
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="1"
          />
        );
      })}
      <polygon
        data-series="relation"
        points={polygonPoints(relPct)}
        fill="none"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />
      <polygon
        data-series="user"
        points={polygonPoints(userPct)}
        fill="hsl(var(--primary))"
        fillOpacity="0.35"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
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
            className="fill-muted-foreground text-[10px] font-medium"
          >
            {el}
          </text>
        );
      })}
    </svg>
  );
}
