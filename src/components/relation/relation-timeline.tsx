'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import type { Mode } from '@/types/mode';
import type { RelationTimelineEvent, RelationTimelineResponse } from '@/types/relation';

interface Props {
  relationId: string;
}

// occurred_at(ISO UTC) → KST 날짜 YYYY.MM.DD 표기.
// 균시차/달력 변환과 무관한 단순 타임존 오프셋 표기 — 날짜 경계만 KST 기준.
function formatKstDate(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

async function fetchTimeline(relationId: string): Promise<RelationTimelineResponse> {
  const res = await fetch(`/api/relations/${relationId}/timeline`);
  if (!res.ok) throw new Error('timeline_fetch_failed');
  return res.json() as Promise<RelationTimelineResponse>;
}

// 타임라인 점 색상 — 이벤트 타입별 (registered 가 시작점이라 muted)
const DOT_COLOR: Record<RelationTimelineEvent['type'], string> = {
  hapcard: 'var(--primary)',
  replay: 'var(--p-30, var(--primary))',
  registered: 'var(--muted-foreground)',
};

export function RelationTimeline({ relationId }: Props) {
  const t = useTranslations('relations.detail.timeline');
  const tMode = useTranslations('relations.new.mode');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['relation-timeline', relationId],
    queryFn: () => fetchTimeline(relationId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div
        data-testid="relation-timeline-skeleton"
        role="status"
        aria-label={t('loading')}
        className="rounded-2xl bg-card p-4 space-y-3 animate-pulse"
      >
        <div className="h-3 w-20 rounded bg-muted" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-muted shrink-0" />
            <div className="h-3 flex-1 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        data-testid="relation-timeline"
        role="alert"
        className="rounded-2xl bg-card p-4 text-sm text-muted-foreground text-center"
      >
        {t('error')}
      </div>
    );
  }

  const events = data?.events ?? [];
  if (events.length === 0) {
    return (
      <div data-testid="relation-timeline" className="rounded-2xl bg-card p-4 space-y-3">
        <p className="font-eyebrow text-muted-foreground">{t('title')}</p>
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div data-testid="relation-timeline" className="rounded-2xl bg-card p-4 space-y-3">
      <p className="font-eyebrow text-muted-foreground">{t('title')}</p>
      <ol className="space-y-3">
        {events.map((event, i) => {
          const modeLabel = event.mode ? tMode(event.mode as Mode) : null;
          const label = modeLabel
            ? `${t(`event.${event.type}`)} · ${modeLabel}`
            : t(`event.${event.type}`);
          return (
            <li
              key={`${event.type}-${event.occurred_at}-${i}`}
              data-testid="relation-timeline-event"
              className="flex items-center gap-3"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: DOT_COLOR[event.type] }}
              />
              <span className="font-cap text-muted-foreground tabular-nums shrink-0 w-[72px]">
                {formatKstDate(event.occurred_at)}
              </span>
              <span className="font-body text-sm text-foreground">{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
