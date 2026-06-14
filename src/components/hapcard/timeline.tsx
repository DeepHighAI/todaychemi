'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

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
}

const BAR_WIDTH = 28;
const BAR_GAP = 12;
const MAX_BAR_H = 48;
const SVG_H = 116;
const BAR_BASE_Y = 82;
const VERSION_MARKER_DASH = '4 4';
const VERSION_MARKER_STROKE_W = 1;

// ADR-036: 표시 구간이 둘 이상의 scoring_version 에 걸치면 경계 인덱스 반환 (없으면 null).
// null 버전(데이터 없는 날짜)은 건너뛰고, 직전 비-null 버전과 달라지는 첫 막대 인덱스를 찾는다.
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

async function fetchSnapshots(hapcardId: string): Promise<HapcardSnapshotsResponse> {
  const res = await fetch(`/api/hapcards/${hapcardId}/snapshots`);
  if (!res.ok) throw new Error('snapshots_fetch_failed');
  return res.json() as Promise<HapcardSnapshotsResponse>;
}

function formatShortDate(date: string): string {
  return date.slice(5).replace('-', '.');
}

function dayLabel(index: number, todayIndex: number): string {
  if (index === todayIndex) return '오늘';
  const delta = index - todayIndex;
  return delta < 0 ? `${Math.abs(delta)}일 전` : `${delta}일 후`;
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
  // 경계 막대 직전 gap 중앙에 점선 세로선 (ADR-036 버전 경계 마커)
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
          stroke="var(--border)"
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
              fill="var(--muted-foreground)"
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
              fill={entry.score === null ? 'var(--muted)' : 'var(--primary)'}
              stroke={isToday ? 'var(--primary)' : 'none'}
              strokeWidth={isToday ? 2 : 0}
              className="motion-safe:transition-all motion-safe:duration-300"
            />
            <text
              x={x + BAR_WIDTH / 2}
              y={SVG_H - 4}
              textAnchor="middle"
              fontSize={8}
              fontWeight={700}
              fill={isToday ? 'var(--primary)' : 'var(--muted-foreground)'}
            >
              {isToday ? '오늘' : formatShortDate(entry.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function HapcardTimeline({ hapcardId, mode }: Props) {
  const t = useTranslations('hapcard.timeline');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hapcard-snapshots', hapcardId, mode],
    queryFn: () => fetchSnapshots(hapcardId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div
        data-testid="hapcard-timeline-skeleton"
        role="status"
        className="rounded-2xl bg-card p-4 space-y-2 animate-pulse"
        aria-label={t('loading')}
      >
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="flex items-end gap-2 h-14">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 rounded bg-muted" style={{ height: `${30 + i * 5}%` }} />
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
        className="rounded-2xl bg-card p-4 text-sm text-muted-foreground text-center"
      >
        {t('error')}
      </div>
    );
  }

  if (!data?.snapshots) return null;

  // ADR-036: 표시 막대가 둘 이상의 scoring_version 에 걸치면 경계 마커 + 안내 캡션
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
    <div data-testid="hapcard-timeline" className="rounded-2xl bg-primary/10 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-eyebrow text-primary">{t('title')}</span>
        <span className="font-cap text-muted-foreground">{t('caption')}</span>
      </div>
      <p className="text-[13px] leading-[1.55] font-semibold text-foreground">{summary}</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[var(--r-md)] bg-[var(--surface)]/70 px-3 py-2">
          <p className="text-[11px] font-bold text-muted-foreground">{t('stat.today')}</p>
          <p className="mt-1 font-bold text-foreground tabular-nums">
            {todayScore === null ? '—' : formatTodayTemperature(todayScore, DETAILED_TEMPERATURE_PRECISION)}
          </p>
        </div>
        <div className="rounded-[var(--r-md)] bg-[var(--surface)]/70 px-3 py-2">
          <p className="text-[11px] font-bold text-muted-foreground">{t('stat.delta')}</p>
          <p className="mt-1 font-bold text-foreground tabular-nums">
            {todayScore === null || !prev ? '—' : formatTemperatureDeltaBetweenScores(prev.score, todayScore, DETAILED_TEMPERATURE_PRECISION)}
          </p>
        </div>
        <div className="rounded-[var(--r-md)] bg-[var(--surface)]/70 px-3 py-2">
          <p className="text-[11px] font-bold text-muted-foreground">{t('stat.records')}</p>
          <p className="mt-1 font-bold text-foreground tabular-nums">{t('stat.recordCount', { count: recordedCount })}</p>
        </div>
      </div>
      <BarChart
        snapshots={data.snapshots}
        todayIndex={data.today_index}
        versionBoundaryIndex={versionBoundaryIndex}
      />
      <div className="space-y-1.5">
        {data.snapshots.map((entry, index) => {
          const isFuture = index > data.today_index;
          const value = entry.score === null
            ? isFuture ? t('status.upcoming') : t('status.empty')
            : formatTodayTemperature(entry.score, DETAILED_TEMPERATURE_PRECISION);
          return (
            <div
              key={entry.date}
              data-testid="hapcard-timeline-row"
              className="flex items-center justify-between gap-3 rounded-[var(--r-sm)] bg-[var(--surface)]/55 px-3 py-2 text-[12px]"
            >
              <span className="font-semibold text-muted-foreground">
                {formatShortDate(entry.date)} · {dayLabel(index, data.today_index)}
              </span>
              <span className={`font-bold tabular-nums ${entry.score === null ? 'text-muted-foreground' : 'text-foreground'}`}>
                {value}
              </span>
            </div>
          );
        })}
      </div>
      {versionBoundaryIndex !== null && (
        <p
          data-testid="hapcard-timeline-version-caption"
          className="font-cap text-muted-foreground text-center"
        >
          {t('version_boundary')}
        </p>
      )}
    </div>
  );
}
