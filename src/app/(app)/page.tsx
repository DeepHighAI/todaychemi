'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { TodayAppBar } from '@/components/today/today-app-bar';
import { DateLine } from '@/components/today/date-line';
import { TodayHero } from '@/components/today/today-hero';
import { AvoidActionCards } from '@/components/today/avoid-action-cards';
import { QuickAddRelation } from '@/components/today/quick-add-relation';
import { WhatifTrigger } from '@/components/today/whatif-trigger';
import { RecentFeedRows } from '@/components/today/recent-feed-rows';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { useTranslations } from 'next-intl';
import { todayKST } from '@/lib/today/kst-date';
import { isErrorCode, type ErrorCode } from '@/lib/errors/error-codes';
import type { DailyHapCard } from '@/types/dailyHap';
import type { ChartCore } from '@/types/chart';
import type { FeedListItem } from '@/types/relation';

// 오늘 홈에 노출할 인연 최대 수 (최근순)
const TOP_N_RELATIONS = 5;

async function fetchToday(): Promise<DailyHapCard> {
  const res = await fetch('/api/today');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = (body as { error?: { code?: string } })?.error?.code ?? 'INTERNAL_ERROR';
    throw new Error(code);
  }
  const body = (await res.json()) as { ok: boolean; card?: DailyHapCard };
  if (!body.ok || !body.card) throw new Error('INTERNAL_ERROR');
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
  const router = useRouter();
  const t = useTranslations('home');
  const todayQuery = useQuery({ queryKey: ['today'], queryFn: fetchToday });
  const chartQuery = useQuery({ queryKey: ['me-chart'], queryFn: fetchMyChart });
  const relationsQuery = useQuery({ queryKey: ['relations'], queryFn: fetchRelations });

  const card = todayQuery.data;
  const chart = chartQuery.data ?? null;
  const relations = relationsQuery.data ?? [];

  const todayErrorMsg = todayQuery.error?.message;
  const todayErrorCode: ErrorCode = isErrorCode(todayErrorMsg) ? todayErrorMsg : 'INTERNAL_ERROR';

  // UNAUTHORIZED → 미들웨어 방어선이 있지만 race condition 대비 클라이언트 리다이렉트
  useEffect(() => {
    if (todayQuery.isError && todayErrorMsg === 'UNAUTHORIZED') {
      router.push('/login');
    }
  }, [todayQuery.isError, todayErrorMsg, router]);

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

      {todayQuery.isError && todayErrorMsg !== 'UNAUTHORIZED' && (
        <div className="px-4">
          <ErrorCard code={todayErrorCode} onRetry={() => todayQuery.refetch()} />
        </div>
      )}

      {card && (
        <>
          {chart && (
            <DateLine date={formatKstDate(todayKST())} dayPillar={chart.day_pillar} />
          )}
          <TodayHero card={card} />
          <section className="space-y-3">
            <div className="px-4">
              <p className="font-eyebrow text-muted-foreground">{t('compat.eyebrow')}</p>
              <h2 className="font-h3 text-foreground">{t('compat.title')}</h2>
            </div>
            <QuickAddRelation />
            <RecentFeedRows rows={topRelations} />
          </section>
          <AvoidActionCards card={card} />
          {chart && <WhatifTrigger />}
        </>
      )}
    </div>
  );
}
