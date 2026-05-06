'use client';

import { useQuery } from '@tanstack/react-query';

import { TodayAppBar } from '@/components/today/today-app-bar';
import { DateLine } from '@/components/today/date-line';
import { TodayHero } from '@/components/today/today-hero';
import { AvoidActionCards } from '@/components/today/avoid-action-cards';
import { QuickAddRelation } from '@/components/today/quick-add-relation';
import { RecentFeedRows } from '@/components/today/recent-feed-rows';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { todayKST } from '@/lib/today/kst-date';
import type { DailyHapCard } from '@/types/dailyHap';
import type { ChartCore } from '@/types/chart';
import type { FeedListItem } from '@/types/relation';

// 오늘 홈에 노출할 인연 최대 수 (최근순)
const TOP_N_RELATIONS = 5;

async function fetchToday(): Promise<DailyHapCard> {
  const res = await fetch('/api/today');
  if (!res.ok) throw new Error('TODAY_FETCH_FAILED');
  const body = (await res.json()) as { ok: boolean; card?: DailyHapCard };
  if (!body.ok || !body.card) throw new Error('TODAY_FETCH_FAILED');
  return body.card;
}

async function fetchMyChart(): Promise<ChartCore | null> {
  const res = await fetch('/api/me/chart');
  if (!res.ok) return null;
  const body = (await res.json()) as { ok: boolean; chart: ChartCore | null };
  return body.chart ?? null;
}

async function fetchRelations(): Promise<FeedListItem[]> {
  const res = await fetch('/api/relations');
  if (!res.ok) return [];
  const body = (await res.json()) as { items: FeedListItem[] };
  return body.items;
}

// 'YYYY-MM-DD' → 'YYYY.MM.DD'
function formatKstDate(iso: string): string {
  return iso.replaceAll('-', '.');
}

export default function TodayPage() {
  const todayQuery = useQuery({ queryKey: ['today'], queryFn: fetchToday });
  const chartQuery = useQuery({ queryKey: ['me-chart'], queryFn: fetchMyChart });
  const relationsQuery = useQuery({ queryKey: ['relations'], queryFn: fetchRelations });

  const card = todayQuery.data;
  const chart = chartQuery.data ?? null;
  const relations = relationsQuery.data ?? [];

  // 인연은 서버가 created_at desc 로 반환하므로 그대로 잘라 Top-N
  const topRelations = relations.slice(0, TOP_N_RELATIONS).map((r) => ({
    id: r.relation_id,
    nickname: r.nickname,
    interpreted: true,
  }));

  return (
    <div className="space-y-4">
      <TodayAppBar />

      {todayQuery.isLoading && (
        <div className="px-4">
          <LoadingState />
        </div>
      )}

      {todayQuery.isError && (
        <div className="px-4">
          <ErrorCard code="LLM_TIMEOUT" onRetry={() => todayQuery.refetch()} />
        </div>
      )}

      {card && (
        <>
          {chart && (
            <DateLine date={formatKstDate(todayKST())} dayPillar={chart.day_pillar} />
          )}
          <TodayHero card={card} />
          <AvoidActionCards card={card} />
          <QuickAddRelation />
          <RecentFeedRows rows={topRelations} />
        </>
      )}
    </div>
  );
}
