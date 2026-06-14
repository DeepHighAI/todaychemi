/**
 * RelationTimeline.tsx — 인연 타임라인 (미니앱 포트)
 *
 * 웹앱 원본: src/components/relation/relation-timeline.tsx
 * 변경: 'use client' 제거, fetch → apiFetch + Bearer 토큰, next-intl useTranslations 유지.
 * S-09 H-1: 메모 제외·최신순·v1 표시 전용 (ADR-039 read-path 비대상).
 */

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { Mode } from '@/types/relation';
import type {
  RelationTimelineEvent,
  RelationTimelineResponse,
} from '@/types/relation';

interface Props {
  relationId: string;
}

// occurred_at(ISO UTC) → KST 날짜 YYYY.MM.DD 표기
function formatKstDate(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

// 타임라인 점 색상 — 이벤트 타입별
const DOT_COLOR: Record<RelationTimelineEvent['type'], string> = {
  hapcard: 'var(--primary)',
  replay: 'var(--p-30, var(--primary))',
  registered: 'var(--muted-foreground)',
};

export function RelationTimeline({ relationId }: Props) {
  const t = useTranslations('relations.detail.timeline');
  const tMode = useTranslations('relations.new.mode');
  const { token } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['relation-timeline', relationId],
    queryFn: () =>
      apiFetch<RelationTimelineResponse>(`/api/relations/${relationId}/timeline`, { token }),
    retry: false,
  });

  if (isLoading) {
    return (
      <div
        data-testid="relation-timeline-skeleton"
        role="status"
        aria-label={t('loading')}
        style={{
          borderRadius: 'var(--r-lg)',
          backgroundColor: 'var(--card)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          opacity: 0.6,
        }}
      >
        <div style={{ height: 12, width: 80, borderRadius: 4, backgroundColor: 'var(--muted)' }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                height: 8,
                width: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--muted)',
                flexShrink: 0,
              }}
            />
            <div style={{ height: 12, flex: 1, borderRadius: 4, backgroundColor: 'var(--muted)' }} />
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
        style={{
          borderRadius: 'var(--r-lg)',
          backgroundColor: 'var(--card)',
          padding: 16,
          fontSize: 14,
          color: 'var(--muted-foreground)',
          textAlign: 'center',
        }}
      >
        {t('error')}
      </div>
    );
  }

  const events = data?.events ?? [];

  if (events.length === 0) {
    return (
      <div
        data-testid="relation-timeline"
        style={{
          borderRadius: 'var(--r-lg)',
          backgroundColor: 'var(--card)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)' }}>
          {t('title')}
        </p>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)' }}>{t('empty')}</p>
      </div>
    );
  }

  return (
    <div
      data-testid="relation-timeline"
      style={{
        borderRadius: 'var(--r-lg)',
        backgroundColor: 'var(--card)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)' }}>
        {t('title')}
      </p>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {events.map((event, i) => {
          const modeLabel = event.mode ? tMode(event.mode as Mode) : null;
          const label = modeLabel
            ? `${t(`event.${event.type}`)} · ${modeLabel}`
            : t(`event.${event.type}`);
          return (
            <li
              key={`${event.type}-${event.occurred_at}-${i}`}
              data-testid="relation-timeline-event"
              style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <span
                aria-hidden="true"
                style={{
                  height: 8,
                  width: 8,
                  borderRadius: '50%',
                  flexShrink: 0,
                  backgroundColor: DOT_COLOR[event.type],
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--muted-foreground)',
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                  width: 72,
                }}
              >
                {formatKstDate(event.occurred_at)}
              </span>
              <span style={{ fontSize: 14, color: 'var(--foreground)' }}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
