/**
 * timeline.tsx — 합온도 7일 흐름 타임라인 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/timeline.tsx
 * 변경: Tailwind → 인라인 스타일, 'use client' 제거, fetch → apiFetch.
 * ADR-033/036: 7일 스냅샷 + scoring_version 경계 마커 유지.
 */

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

import {
  DETAILED_TEMPERATURE_PRECISION,
  formatTemperatureDeltaBetweenScores,
  formatTodayTemperature,
  temperatureDeltaBetweenScores,
} from '@/lib/scoring/temperature';
import type { HapcardSnapshotsResponse, HapcardSnapshotEntry } from '@/types/hapcard';

interface Props {
  hapcardId: string;
  mode: string;
  /** Bearer 토큰 (인증 필요 경로) */
  token?: string | null;
}

const BAR_WIDTH = 28;
const BAR_GAP = 12;
const MAX_BAR_H = 48;
const SVG_H = 116;
const BAR_BASE_Y = 82;
const VERSION_MARKER_DASH = '4 4';
const VERSION_MARKER_STROKE_W = 1;

// ADR-036: 표시 구간이 둘 이상의 scoring_version 에 걸치면 경계 인덱스 반환 (없으면 null).
function findVersionBoundaryIndex(snapshots: HapcardSnapshotEntry[]): number | null {
  let prevVersion: string | null = null;
  for (let i = 0; i < snapshots.length; i++) {
    const version = snapshots[i].scoring_version ?? null;
    if (version === null) continue;
    if (prevVersion !== null && version !== prevVersion) return i;
    prevVersion = version;
  }
  return null;
}

async function fetchSnapshots(hapcardId: string, token?: string | null): Promise<HapcardSnapshotsResponse> {
  return apiFetch<HapcardSnapshotsResponse>(`/api/hapcards/${hapcardId}/snapshots`, { token });
}

function formatShortDate(date: string): string {
  return date.slice(5).replace('-', '.');
}

function recordedBeforeToday(
  snapshots: HapcardSnapshotEntry[],
  todayIndex: number,
): HapcardSnapshotEntry | null {
  for (let i = todayIndex - 1; i >= 0; i--) {
    if (snapshots[i]?.score !== null && snapshots[i]?.score !== undefined) return snapshots[i];
  }
  return null;
}

function BarChart({
  snapshots,
  todayIndex,
  versionBoundaryIndex,
}: {
  snapshots: HapcardSnapshotEntry[];
  todayIndex: number;
  versionBoundaryIndex: number | null;
}) {
  const svgW = snapshots.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
  const boundaryX =
    versionBoundaryIndex === null
      ? null
      : versionBoundaryIndex * (BAR_WIDTH + BAR_GAP) - BAR_GAP / 2;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgW} ${SVG_H}`}
      aria-hidden="true"
      preserveAspectRatio="xMidYMax meet"
    >
      {boundaryX !== null && (
        <line
          data-testid="hapcard-timeline-version-marker"
          x1={boundaryX}
          x2={boundaryX}
          y1={0}
          y2={BAR_BASE_Y}
          stroke="var(--hairline)"
          strokeWidth={VERSION_MARKER_STROKE_W}
          strokeDasharray={VERSION_MARKER_DASH}
        />
      )}
      {snapshots.map((entry, i) => {
        const isToday = i === todayIndex;
        const h = entry.score === null ? 4 : Math.max(4, (entry.score / 100) * MAX_BAR_H);
        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = BAR_BASE_Y - h;
        return (
          <g key={entry.date}>
            <text
              x={x + BAR_WIDTH / 2}
              y={entry.score === null ? BAR_BASE_Y - 10 : y - 5}
              textAnchor="middle"
              fontSize={8}
              fontWeight={700}
              fill="var(--text-secondary)"
            >
              {entry.score === null ? '—' : formatTodayTemperature(entry.score, DETAILED_TEMPERATURE_PRECISION).replace('C', '')}
            </text>
            <rect
              data-testid="hapcard-timeline-bar"
              data-today={isToday ? 'true' : 'false'}
              x={x}
              y={y}
              width={BAR_WIDTH}
              height={h}
              rx={4}
              fill={entry.score === null ? 'var(--surface-2)' : 'var(--primary)'}
              stroke={isToday ? 'var(--primary)' : 'none'}
              strokeWidth={isToday ? 2 : 0}
            />
            <text
              x={x + BAR_WIDTH / 2}
              y={SVG_H - 4}
              textAnchor="middle"
              fontSize={8}
              fontWeight={700}
              fill={isToday ? 'var(--primary)' : 'var(--text-secondary)'}
            >
              {isToday ? '오늘' : formatShortDate(entry.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function HapcardTimeline({ hapcardId, mode, token }: Props) {
  const t = useTranslations('hapcard.timeline');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hapcard-snapshots', hapcardId, mode],
    queryFn: () => fetchSnapshots(hapcardId, token),
    retry: false,
  });

  if (isLoading) {
    return (
      <div
        data-testid="hapcard-timeline-skeleton"
        role="status"
        style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}
        aria-label={t('loading')}
      >
        <div style={{ height: 12, width: 64, borderRadius: 4, backgroundColor: 'var(--surface-2)' }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 56 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ flex: 1, borderRadius: 4, backgroundColor: 'var(--surface-2)', height: `${30 + i * 5}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        data-testid="hapcard-timeline"
        role="alert"
        style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 16, fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}
      >
        {t('error')}
      </div>
    );
  }

  if (!data?.snapshots) return null;

  const versionBoundaryIndex = findVersionBoundaryIndex(data.snapshots);
  const today = data.snapshots[data.today_index] ?? null;
  const todayScore = today?.score ?? null;
  const prev = recordedBeforeToday(data.snapshots, data.today_index);
  const temperatureDelta = todayScore !== null
    ? temperatureDeltaBetweenScores(prev?.score, todayScore, DETAILED_TEMPERATURE_PRECISION)
    : 0;
  const recordedCount = data.snapshots.filter((entry) => entry.score !== null).length;
  const summary = (() => {
    if (todayScore === null) return t('summary.missingToday');
    const temperature = formatTodayTemperature(todayScore, DETAILED_TEMPERATURE_PRECISION);
    if (!prev) return t('summary.first', { date: formatShortDate(today.date), temperature });
    if (temperatureDelta === 0) return t('summary.same', { date: formatShortDate(today.date), temperature });
    return t('summary.changed', {
      date: formatShortDate(today.date),
      temperature,
      delta: formatTemperatureDeltaBetweenScores(prev.score, todayScore, DETAILED_TEMPERATURE_PRECISION),
    });
  })();

  return (
    <div data-testid="hapcard-timeline" style={{ borderRadius: 16, backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ font: 'var(--t-cap)', color: 'var(--primary)' }}>{t('title')}</span>
        <span style={{ font: 'var(--t-cap)', color: 'var(--text-secondary)' }}>{t('caption')}</span>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.55, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{summary}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { label: t('stat.today'), value: todayScore === null ? '—' : formatTodayTemperature(todayScore, DETAILED_TEMPERATURE_PRECISION) },
          { label: t('stat.delta'), value: (todayScore === null || !prev) ? '—' : formatTemperatureDeltaBetweenScores(prev.score, todayScore, DETAILED_TEMPERATURE_PRECISION) },
          { label: t('stat.records'), value: t('stat.recordCount', { count: recordedCount }) },
        ].map(({ label, value }) => (
          <div key={label} style={{ borderRadius: 'var(--r-md)', backgroundColor: 'rgba(255,255,255,0.7)', padding: '8px 12px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>
      <BarChart
        snapshots={data.snapshots}
        todayIndex={data.today_index}
        versionBoundaryIndex={versionBoundaryIndex}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.snapshots.map((entry, index) => {
          const isFuture = index > data.today_index;
          const value = entry.score === null
            ? isFuture ? t('status.upcoming') : t('status.empty')
            : formatTodayTemperature(entry.score, DETAILED_TEMPERATURE_PRECISION);
          return (
            <div
              key={entry.date}
              data-testid="hapcard-timeline-row"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 'var(--r-sm)', backgroundColor: 'rgba(255,255,255,0.55)', padding: '8px 12px', fontSize: 12 }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {formatShortDate(entry.date)} · {index === data.today_index ? '오늘' : index < data.today_index ? `${data.today_index - index}일 전` : `${index - data.today_index}일 후`}
              </span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: entry.score === null ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                {value}
              </span>
            </div>
          );
        })}
      </div>
      {versionBoundaryIndex !== null && (
        <p
          data-testid="hapcard-timeline-version-caption"
          style={{ font: 'var(--t-cap)', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}
        >
          {t('version_boundary')}
        </p>
      )}
    </div>
  );
}
