'use client';

import type { FlowPoint } from '@/types/relation';

interface Props {
  points: FlowPoint[];
}

const SVG_H = 80;
const SVG_W = 280;
const PAD_X = 8;
const PAD_Y = 6;

function scoreToY(score: number): number {
  // score 0 → 하단(SVG_H - PAD_Y), score 100 → 상단(PAD_Y)
  return PAD_Y + ((100 - score) / 100) * (SVG_H - PAD_Y * 2);
}

function indexToX(i: number, total: number): number {
  if (total === 1) return SVG_W / 2;
  return PAD_X + (i / (total - 1)) * (SVG_W - PAD_X * 2);
}

export function RelationFlowChart({ points }: Props) {
  if (points.length === 0) {
    return (
      <div
        data-testid="flow-chart-empty"
        className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground"
      >
        아직 흐름 데이터가 없어요
      </div>
    );
  }

  const coords = points.map((p, i) => ({
    x: indexToX(i, points.length),
    y: scoreToY(p.score),
    isLast: i === points.length - 1,
  }));

  const polylinePoints = points.length >= 2
    ? coords.map(c => `${c.x},${c.y}`).join(' ')
    : null;

  return (
    <div data-testid="flow-chart" className="rounded-2xl bg-primary/10 p-4 space-y-1">
      <span className="font-eyebrow text-primary text-xs">합흐름</span>
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
      >
        {polylinePoints && (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="motion-safe:transition-all motion-safe:duration-300"
          />
        )}
        {coords.map((c, i) => (
          <circle
            key={points[i].date}
            data-testid="flow-point"
            data-today={c.isLast ? 'true' : 'false'}
            cx={c.x}
            cy={c.y}
            r={c.isLast ? 5 : 3}
            fill={c.isLast ? 'var(--primary)' : 'var(--primary)'}
            stroke={c.isLast ? 'var(--background)' : 'none'}
            strokeWidth={c.isLast ? 2 : 0}
          />
        ))}
      </svg>
    </div>
  );
}
