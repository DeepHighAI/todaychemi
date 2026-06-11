'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import type { HapcardSnapshotsResponse, HapcardSnapshotEntry } from '@/types/hapcard';

interface Props {
  hapcardId: string;
  mode: string;
}

const BAR_WIDTH = 28;
const BAR_GAP = 12;
const MAX_BAR_H = 56;
const SVG_H = 80;
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
          y2={SVG_H}
          stroke="var(--border)"
          strokeWidth={VERSION_MARKER_STROKE_W}
          strokeDasharray={VERSION_MARKER_DASH}
        />
      )}
      {snapshots.map((entry, i) => {
        const isToday = i === todayIndex;
        const h = entry.score === null ? 4 : Math.max(4, (entry.score / 100) * MAX_BAR_H);
        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = SVG_H - h - (isToday ? 0 : 0);
        return (
          <rect
            key={entry.date}
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
        {t('title')}
      </div>
    );
  }

  if (!data?.snapshots) return null;

  // ADR-036: 표시 막대가 둘 이상의 scoring_version 에 걸치면 경계 마커 + 안내 캡션
  const versionBoundaryIndex = findVersionBoundaryIndex(data.snapshots);

  return (
    <div data-testid="hapcard-timeline" className="rounded-2xl bg-primary/10 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-eyebrow text-primary">{t('title')}</span>
        <span className="font-cap text-muted-foreground">{t('caption')}</span>
      </div>
      <BarChart
        snapshots={data.snapshots}
        todayIndex={data.today_index}
        versionBoundaryIndex={versionBoundaryIndex}
      />
      <p className="text-xs text-center text-primary font-medium">{t('today')}</p>
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
