'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';
import type { HapcardResult, HapcardErrorCode } from '@/types/hapcard';
import { HapcardHeader } from '@/components/hapcard/header';
import { HapcardGauge } from '@/components/hapcard/gauge';
import { HapcardBody } from '@/components/hapcard/body';
import { HapcardOhaeng } from '@/components/hapcard/ohaeng';
import { HapcardMiniRadar } from '@/components/hapcard/mini-radar';
import { HapcardEvidence } from '@/components/hapcard/evidence';
import { HapcardActions } from '@/components/hapcard/actions';
import { HapcardClassic } from '@/components/hapcard/classic';
import { HapcardConclusion } from '@/components/hapcard/conclusion';
import { HapcardFooter } from '@/components/hapcard/footer';
import { HapcardShare } from '@/components/hapcard/share';
import { GlossaryProvider } from '@/components/hapcard/glossary-provider';
import { GlossarySheet } from '@/components/hapcard/glossary-sheet';

const CHART_PENDING_CODES: HapcardErrorCode[] = [
  'RELATION_CHART_NOT_FOUND',
  'USER_CHART_NOT_FOUND',
];

async function callHapcard(relationId: string, mode: string): Promise<HapcardResult> {
  const res = await fetch('/api/hapcards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      relation_id: relationId,
      mode,
      theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code: HapcardErrorCode = body?.error?.code ?? 'INTERNAL_ERROR';
    throw Object.assign(new Error(code), { code });
  }
  return res.json() as Promise<HapcardResult>;
}

function isChartPendingError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return CHART_PENDING_CODES.includes(code as HapcardErrorCode);
}

export default function HapcardView() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const mode = sp.get('mode');

  const t = useTranslations('hapcard');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['hapcard', id, mode],
    queryFn: () => callHapcard(id, mode!),
    enabled: !!mode,
    retry: false,
  });

  if (!mode || (isError && !isChartPendingError(error))) {
    return (
      <main className="bg-background min-h-screen px-4 pt-8">
        <p className="text-sm text-destructive text-center py-8">{t('errors.generic')}</p>
      </main>
    );
  }

  if (isError && isChartPendingError(error)) {
    return (
      <main className="bg-background min-h-screen px-4 pt-8">
        <div className="rounded-2xl bg-card p-6 text-center space-y-3">
          <p className="text-base font-bold text-foreground">{t('errors.chartPending.title')}</p>
          <p className="text-sm text-muted-foreground">{t('errors.chartPending.body')}</p>
          <Link href="/feed" className="inline-block text-sm text-primary underline">
            {t('errors.chartPending.cta')}
          </Link>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="bg-background min-h-screen px-4 pt-8">
        <div data-testid="hapcard-skeleton" className="space-y-3 animate-pulse">
          <div className="h-10 rounded-2xl bg-card" />
          <div className="h-24 rounded-2xl bg-card" />
          <div className="h-40 rounded-2xl bg-card" />
        </div>
      </main>
    );
  }

  // visuals 부재 시 placeholder (fortune-core 미구현 중 임시 UX)
  if (!data?.visuals) {
    return (
      <main className="bg-background min-h-screen px-4 pt-8">
        <div data-testid="hapcard-placeholder" className="rounded-2xl bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('placeholder')}</p>
        </div>
      </main>
    );
  }

  const { visuals } = data;

  return (
    <GlossaryProvider>
    <main className="bg-background min-h-screen px-4 pt-8 pb-16 space-y-3">
      <HapcardHeader
        mode={mode!}
        userPillar={visuals.user.day_pillar}
        userElement={visuals.user.day_master_element}
        relationPillar={visuals.relation.day_pillar}
        relationElement={visuals.relation.day_master_element}
      />
      <HapcardGauge score={data.compat_score} breakdown={data.score_breakdown} />
      <HapcardConclusion mainText={data.content.main_text} />
      <HapcardBody mainText={data.content.main_text} />
      <HapcardOhaeng
        userCounts={visuals.user.five_elements_counts}
        relationCounts={visuals.relation.five_elements_counts}
      />
      <HapcardMiniRadar
        user={visuals.user.five_elements_counts}
        relation={visuals.relation.five_elements_counts}
      />
      <HapcardEvidence cards={data.content.why_cards} />
      <HapcardActions actions={data.content.actions} />
      <HapcardClassic citations={data.content.classic_citation} />
      <HapcardFooter />
      <HapcardShare
        hapcardId={data.hapcard_id}
        mode={mode!}
        nickname={data.relation_nickname}
        score={data.compat_score}
        genderNormalized={data.relation_gender_normalized}
        visuals={visuals}
      />
    </main>
    <GlossarySheet />
    </GlossaryProvider>
  );
}
