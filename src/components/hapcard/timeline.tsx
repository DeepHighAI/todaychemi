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

async function fetchSnapshots(hapcardId: string): Promise<HapcardSnapshotsResponse> {
  const res = await fetch(`/api/hapcards/${hapcardId}/snapshots`);
  if (!res.ok) throw new Error('snapshots_fetch_failed');
  return res.json() as Promise<HapcardSnapshotsResponse>;
}

function BarChart({
  snapshots,
  todayIndex,
}: {
  snapshots: HapcardSnapshotEntry[];
  todayIndex: number;
}) {
  const svgW = snapshots.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgW} ${SVG_H}`}
      aria-hidden="true"
      preserveAspectRatio="xMidYMax meet"
    >
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

  return (
    <div data-testid="hapcard-timeline" className="rounded-2xl bg-primary/10 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-eyebrow text-primary">{t('title')}</span>
        <span className="font-cap text-muted-foreground">{t('caption')}</span>
      </div>
      <BarChart snapshots={data.snapshots} todayIndex={data.today_index} />
      <p className="text-xs text-center text-primary font-medium">{t('today')}</p>
    </div>
  );
}
