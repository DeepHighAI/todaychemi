'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';
import type { HapcardResult, HapcardErrorCode } from '@/types/hapcard';

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

export default function HapcardPage() {
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

  return (
    <main className="bg-background min-h-screen px-4 pt-8">
      <div data-testid="hapcard-placeholder" className="rounded-2xl bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{t('placeholder')}</p>
      </div>
    </main>
  );
}
