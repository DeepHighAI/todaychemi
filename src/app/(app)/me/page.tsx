'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { MeHero } from '@/components/me/me-hero';
import { MeEditRow } from '@/components/me/me-edit-row';
import { MeEditDrawer } from '@/components/me/me-edit-drawer';
import { PillarGrid } from '@/components/me/pillar-grid';
import { OhaengBars } from '@/components/hapcard/primitives/ohaeng-bars';
import { DayMasterCard } from '@/components/me/day-master-card';
import YunseCard from '@/components/me/yunse-card';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import type { ChartCore } from '@/types/chart';

async function fetchMyChart(): Promise<ChartCore | null> {
  const res = await fetch('/api/me/chart');
  if (!res.ok) throw new Error('ME_CHART_FETCH_FAILED');
  const body = (await res.json()) as { ok: boolean; chart: ChartCore | null };
  return body.chart ?? null;
}

export default function MePage() {
  const t = useTranslations('me');
  const router = useRouter();
  const { data: chart, isLoading, isError, refetch } = useQuery({
    queryKey: ['me-chart'],
    queryFn: fetchMyChart,
  });
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <LoadingState />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-6">
        <ErrorCard code="NETWORK_OFFLINE" onRetry={() => refetch()} />
      </div>
    );
  }

  if (!chart) {
    return (
      <EmptyState
        title={t('empty.title')}
        body={t('empty.body')}
        cta={t('empty.cta')}
        onCta={() => router.push('/onboarding')}
      />
    );
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <MeHero chart={chart} />
      <MeEditRow onClick={() => setEditOpen(true)} />
      <MeEditDrawer open={editOpen} onOpenChange={setEditOpen} />
      <PillarGrid chart={chart} />
      <OhaengBars data={chart.five_elements_counts} />
      <DayMasterCard element={chart.day_master_element} />
      <YunseCard yunse={chart.yunse} />
    </div>
  );
}
