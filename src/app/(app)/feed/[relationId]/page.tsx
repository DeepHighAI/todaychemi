'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { RelationFlowChart } from '@/components/relation/relation-flow-chart';
import { computeChangeScore } from '@/lib/scoring/changeScore';
import { formatTodayTemperature, formatTemperatureDelta } from '@/lib/scoring/temperature';
import type { RelationDetailResponse } from '@/types/relation';

async function fetchRelationDetail(id: string): Promise<RelationDetailResponse> {
  const res = await fetch(`/api/relations/${id}`);
  if (!res.ok) throw new Error('FETCH_FAILED');
  return res.json() as Promise<RelationDetailResponse>;
}

export default function RelationDetailPage() {
  const { relationId } = useParams<{ relationId: string }>();
  const router = useRouter();
  const t = useTranslations('relations.detail');
  const tMode = useTranslations('relations.new.mode');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['relation-detail', relationId],
    queryFn: () => fetchRelationDetail(relationId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div data-testid="relation-detail-skeleton" className="bg-background min-h-screen px-4 pt-8 pb-32 space-y-4 animate-pulse">
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="h-24 rounded-2xl bg-muted" />
        <div className="h-20 rounded-2xl bg-muted" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <main className="bg-background min-h-screen px-4 pt-8 pb-32">
        <ErrorCard code="INTERNAL_ERROR" />
      </main>
    );
  }

  const { relation, chart, flow } = data;
  const lastScore = flow.length > 0 ? flow[flow.length - 1].score : null;
  const prevScore = flow.length > 1 ? flow[flow.length - 2].score : null;
  const changeScore = lastScore !== null ? computeChangeScore(prevScore ?? null, lastScore) : 0;

  function handleCta() {
    router.push(`/hapcard/${relation.relation_id}?mode=${encodeURIComponent(relation.mode)}`);
  }

  return (
    <main className="bg-background min-h-screen pb-32">
      {/* AppBar */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md flex items-center gap-3 px-4 py-3 border-b border-[var(--surface-2)]">
        <button type="button" onClick={() => router.back()} className="p-1 -ml-1 text-foreground" aria-label="뒤로">
          ←
        </button>
        <h1 className="font-h3 text-foreground truncate flex-1">{relation.nickname}</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* 인연 요약 카드 */}
        <div className="rounded-2xl bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-h2 text-foreground">{relation.nickname}</span>
            <Badge variant="secondary">{tMode(relation.mode)}</Badge>
          </div>
          {lastScore !== null && (
            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-2xl tabular-nums text-foreground">
                {formatTodayTemperature(lastScore)}
              </span>
              {changeScore !== 0 && (
                <span className={`text-sm font-bold ${changeScore > 0 ? 'text-[var(--ok)]' : 'text-[var(--warn)]'}`}>
                  {changeScore > 0 ? '↑' : '↓'} {formatTemperatureDelta(changeScore)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 합흐름 그래프 */}
        <RelationFlowChart points={flow} />

        {/* 본명식 요약 (chart 있을 때만) */}
        {chart && (
          <div data-testid="relation-chart-section" className="rounded-2xl bg-card p-4">
            <p className="font-eyebrow text-muted-foreground mb-2">{t('chart')}</p>
            <p className="font-body text-foreground">{chart.day_pillar}</p>
          </div>
        )}

        {/* CTA */}
        <Button type="button" className="w-full h-12" onClick={handleCta}>
          {t('cta')}
        </Button>
      </div>
    </main>
  );
}
