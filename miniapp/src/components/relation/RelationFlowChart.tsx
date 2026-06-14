/**
 * RelationFlowChart.tsx — 합흐름 SVG 차트 (미니앱 포트)
 *
 * 웹앱 원본: src/components/relation/relation-flow-chart.tsx
 * 변경: 'use client' 제거, Tailwind → 인라인 스타일, next/* 없음.
 * SVG 렌더링 로직은 그대로 유지.
 */

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

// SVG 레이아웃 상수
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
  const temperatures = points.map((p) =>
    scoreToTemperature(p.score, DETAILED_TEMPERATURE_PRECISION),
  );
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
        style={{
          borderRadius: 'var(--r-lg)',
          backgroundColor: 'var(--card)',
          padding: 16,
          textAlign: 'center',
          fontSize: 14,
          color: 'var(--muted-foreground)',
        }}
      >
        아직 흐름 데이터가 없어요
      </div>
    );
  }

  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ordered[ordered.length - 1];
  const prev = ordered.length > 1 ? ordered[ordered.length - 2] : null;
  const temperatureDelta = temperatureDeltaBetweenScores(
    prev?.score,
    latest.score,
    DETAILED_TEMPERATURE_PRECISION,
  );
  const domain = domainFor(ordered);
  const ticks = [
    { label: `${domain.max.toFixed(1)}°`, y: PAD_T },
    {
      label: `${((domain.max + domain.min) / 2).toFixed(1)}°`,
      y: PAD_T + (SVG_H - PAD_T - PAD_B) / 2,
    },
    { label: `${domain.min.toFixed(1)}°`, y: SVG_H - PAD_B },
  ];
  const recent = ordered.slice(-3).reverse();

  const coords = ordered.map((p, i) => ({
    x: indexToX(i, points.length),
    y: scoreToY(p.score, domain),
    isLast: i === ordered.length - 1,
  }));

  const polylinePoints =
    ordered.length >= 2 ? coords.map((c) => `${c.x},${c.y}`).join(' ') : null;

  // 변화 색조 인라인 스타일
  const deltaBg =
    temperatureDelta > 0
      ? 'var(--ok-bg)'
      : temperatureDelta < 0
        ? 'var(--warn-bg)'
        : 'var(--surface-2)';
  const deltaColor =
    temperatureDelta > 0
      ? 'var(--ok)'
      : temperatureDelta < 0
        ? 'var(--warn)'
        : 'var(--muted-foreground)';

  return (
    <div
      data-testid="flow-chart"
      style={{
        borderRadius: 'var(--r-lg)',
        backgroundColor: 'var(--card)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: 'var(--e-1)',
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ font: 'var(--t-cap)', color: 'var(--primary)', display: 'block' }}>합흐름</span>
          <p style={{ font: 'var(--t-body)', color: 'var(--muted-foreground)', margin: '4px 0 0' }}>
            {describeFlow(ordered, temperatureDelta)}
          </p>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <p
            style={{
              font: 'var(--t-display)',
              fontWeight: 800,
              lineHeight: 1,
              color: 'var(--foreground)',
              fontVariantNumeric: 'tabular-nums',
              margin: 0,
            }}
          >
            {formatTodayTemperature(latest.score, DETAILED_TEMPERATURE_PRECISION)}
          </p>
          <span
            style={{
              display: 'inline-flex',
              marginTop: 8,
              borderRadius: 'var(--r-pill)',
              padding: '4px 8px',
              fontSize: 12,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              backgroundColor: deltaBg,
              color: deltaColor,
            }}
          >
            {ordered.length === 1
              ? '첫 기록'
              : formatTemperatureDeltaBetweenScores(prev?.score, latest.score, DETAILED_TEMPERATURE_PRECISION)}
          </span>
        </div>
      </div>

      {/* SVG 차트 */}
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
            <text
              x={0}
              y={tick.y + 4}
              fontSize={10}
              fontWeight={700}
              fill="var(--muted-foreground)"
            >
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
            fill="var(--primary)"
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

      {/* 요약 통계 3칸 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          {
            label: '최근',
            value: formatTodayTemperature(latest.score, DETAILED_TEMPERATURE_PRECISION),
          },
          {
            label: '직전 대비',
            value:
              ordered.length === 1
                ? '—'
                : formatTemperatureDeltaBetweenScores(
                    prev?.score,
                    latest.score,
                    DETAILED_TEMPERATURE_PRECISION,
                  ),
          },
          { label: '기록', value: `${ordered.length}회` },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              borderRadius: 'var(--r-md)',
              backgroundColor: 'var(--surface-1)',
              padding: '8px 12px',
            }}
          >
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)' }}>
              {label}
            </p>
            <p
              style={{
                margin: '4px 0 0',
                fontWeight: 700,
                color: 'var(--foreground)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* 최근 기록 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recent.map((point, index) => (
          <div
            key={point.date}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: 14,
            }}
          >
            <span style={{ color: 'var(--muted-foreground)' }}>
              {index === 0 ? '최신' : formatDate(point.date)}
            </span>
            <span
              style={{
                fontWeight: 700,
                color: 'var(--foreground)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatTodayTemperature(point.score, DETAILED_TEMPERATURE_PRECISION)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
