'use client';

import {
  DETAILED_TEMPERATURE_PRECISION,
  formatTemperatureDeltaBetweenScores,
  formatTodayTemperature,
  scoreToTemperature,
  temperatureDeltaBetweenScores,
} from '@/lib/scoring/temperature';
import type { FlowPoint } from '@/types/relation';

interface Props {
  points: FlowPoint[];
}

const SVG_H = 156;
const SVG_W = 320;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 18;
const PAD_B = 30;
const MIN_TEMPERATURE_DOMAIN_SPAN = 0.3;

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(score) ? score : 50));
}

function domainFor(points: FlowPoint[]): { min: number; max: number } {
  const temperatures = points.map((p) => scoreToTemperature(p.score, DETAILED_TEMPERATURE_PRECISION));
  const min = Math.min(...temperatures);
  const max = Math.max(...temperatures);
  const span = Math.max(max - min, MIN_TEMPERATURE_DOMAIN_SPAN);
  const mid = (min + max) / 2;
  let low = mid - span / 2;
  let high = mid + span / 2;

  if (low < 35.5) {
    high = Math.min(38.9, high + (35.5 - low));
    low = 35.5;
  }
  if (high > 38.9) {
    low = Math.max(35.5, low - (high - 38.9));
    high = 38.9;
  }
  return { min: low, max: high };
}

function scoreToY(score: number, domain: { min: number; max: number }): number {
  const safe = scoreToTemperature(clampScore(score), DETAILED_TEMPERATURE_PRECISION);
  const ratio = (domain.max - safe) / Math.max(0.1, domain.max - domain.min);
  return PAD_T + ratio * (SVG_H - PAD_T - PAD_B);
}

function indexToX(i: number, total: number): number {
  if (total === 1) return (PAD_L + SVG_W - PAD_R) / 2;
  return PAD_L + (i / (total - 1)) * (SVG_W - PAD_L - PAD_R);
}

function formatDate(date: string): string {
  return date.replaceAll('-', '.');
}

function describeFlow(points: FlowPoint[], temperatureDelta: number): string {
  const latest = points[points.length - 1];
  const latestText = `${formatDate(latest.date)} 기준 ${formatTodayTemperature(latest.score, DETAILED_TEMPERATURE_PRECISION)}`;
  if (points.length === 1) return `${latestText} 첫 기록이에요.`;
  if (temperatureDelta === 0) return `${latestText}이고, 직전 기록과 같은 온도예요.`;
  return `${latestText}이고, 직전 기록보다 ${formatTemperatureDeltaBetweenScores(points[points.length - 2]?.score, latest.score, DETAILED_TEMPERATURE_PRECISION)} 변했어요.`;
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

  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ordered[ordered.length - 1];
  const prev = ordered.length > 1 ? ordered[ordered.length - 2] : null;
  const temperatureDelta = temperatureDeltaBetweenScores(prev?.score, latest.score, DETAILED_TEMPERATURE_PRECISION);
  const domain = domainFor(ordered);
  const ticks = [
    { label: `${domain.max.toFixed(1)}°`, y: PAD_T },
    { label: `${((domain.max + domain.min) / 2).toFixed(1)}°`, y: PAD_T + (SVG_H - PAD_T - PAD_B) / 2 },
    { label: `${domain.min.toFixed(1)}°`, y: SVG_H - PAD_B },
  ];
  const recent = ordered.slice(-3).reverse();

  const coords = ordered.map((p, i) => ({
    x: indexToX(i, points.length),
    y: scoreToY(p.score, domain),
    isLast: i === ordered.length - 1,
  }));

  const polylinePoints = ordered.length >= 2
    ? coords.map(c => `${c.x},${c.y}`).join(' ')
    : null;
  const deltaTone = temperatureDelta > 0
    ? 'bg-[var(--ok-bg)] text-[var(--ok)]'
    : temperatureDelta < 0
      ? 'bg-[var(--warn-bg)] text-[var(--warn)]'
      : 'bg-[var(--surface-2)] text-muted-foreground';

  return (
    <div data-testid="flow-chart" className="rounded-2xl bg-card p-4 space-y-4 shadow-[var(--e-1)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <span className="font-eyebrow text-primary text-xs">합흐름</span>
          <p className="font-body text-muted-foreground">{describeFlow(ordered, temperatureDelta)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl font-extrabold leading-none text-foreground tabular-nums">
            {formatTodayTemperature(latest.score, DETAILED_TEMPERATURE_PRECISION)}
          </p>
          <p className={`mt-2 inline-flex rounded-[var(--r-pill)] px-2 py-1 text-xs font-bold tabular-nums ${deltaTone}`}>
            {ordered.length === 1 ? '첫 기록' : formatTemperatureDeltaBetweenScores(prev?.score, latest.score, DETAILED_TEMPERATURE_PRECISION)}
          </p>
        </div>
      </div>

      <svg
        width="100%"
        height={180}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        role="img"
        aria-label={`합흐름 차트: ${describeFlow(ordered, temperatureDelta)}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {ticks.map((tick) => (
          <g key={tick.label}>
            <line
              x1={PAD_L}
              x2={SVG_W - PAD_R}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray={tick.y === ticks[1].y ? '4 5' : undefined}
            />
            <text x={0} y={tick.y + 4} fontSize={10} fontWeight={700} fill="var(--muted-foreground)">
              {tick.label}
            </text>
          </g>
        ))}
        {polylinePoints && (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="motion-safe:transition-all motion-safe:duration-300"
          />
        )}
        {coords.map((c, i) => (
          <circle
            key={ordered[i].date}
            data-testid="flow-point"
            data-today={c.isLast ? 'true' : 'false'}
            cx={c.x}
            cy={c.y}
            r={c.isLast ? 6 : 4}
            fill={c.isLast ? 'var(--primary)' : 'var(--primary)'}
            stroke={c.isLast ? 'var(--background)' : 'none'}
            strokeWidth={c.isLast ? 2 : 0}
          />
        ))}
        {ordered.map((point, i) => {
          if (ordered.length > 4 && i !== 0 && i !== ordered.length - 1) return null;
          const x = indexToX(i, ordered.length);
          return (
            <text
              key={`${point.date}-label`}
              x={x}
              y={SVG_H - 8}
              textAnchor={i === 0 ? 'start' : i === ordered.length - 1 ? 'end' : 'middle'}
              fontSize={10}
              fontWeight={700}
              fill="var(--muted-foreground)"
            >
              {formatDate(point.date).slice(5)}
            </text>
          );
        })}
      </svg>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[var(--r-md)] bg-[var(--surface-1)] px-3 py-2">
          <p className="text-[11px] font-bold text-muted-foreground">최근</p>
          <p className="mt-1 font-bold text-foreground tabular-nums">{formatTodayTemperature(latest.score, DETAILED_TEMPERATURE_PRECISION)}</p>
        </div>
        <div className="rounded-[var(--r-md)] bg-[var(--surface-1)] px-3 py-2">
          <p className="text-[11px] font-bold text-muted-foreground">직전 대비</p>
          <p className="mt-1 font-bold text-foreground tabular-nums">
            {ordered.length === 1 ? '—' : formatTemperatureDeltaBetweenScores(prev?.score, latest.score, DETAILED_TEMPERATURE_PRECISION)}
          </p>
        </div>
        <div className="rounded-[var(--r-md)] bg-[var(--surface-1)] px-3 py-2">
          <p className="text-[11px] font-bold text-muted-foreground">기록</p>
          <p className="mt-1 font-bold text-foreground tabular-nums">{ordered.length}회</p>
        </div>
      </div>

      <div className="space-y-2">
        {recent.map((point, index) => (
          <div key={point.date} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{index === 0 ? '최신' : formatDate(point.date)}</span>
            <span className="font-bold text-foreground tabular-nums">{formatTodayTemperature(point.score, DETAILED_TEMPERATURE_PRECISION)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
