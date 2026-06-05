'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

const LOADING_PHASES = [
  { key: 'structure', startsAtMs: 0 },
  { key: 'balance', startsAtMs: 10_000 },
  { key: 'writing', startsAtMs: 25_000 },
  { key: 'longWait', startsAtMs: 45_000 },
] as const;

type LoadingPhaseKey = (typeof LOADING_PHASES)[number]['key'];

export function HapcardLoadingState() {
  const t = useTranslations('hapcard.loadingView');
  const [phaseKey, setPhaseKey] = useState<LoadingPhaseKey>('structure');
  const isLongWait = phaseKey === 'longWait';

  useEffect(() => {
    const timers = LOADING_PHASES.slice(1).map((phase) =>
      window.setTimeout(() => setPhaseKey(phase.key), phase.startsAtMs),
    );

    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    <section
      aria-busy="true"
      aria-labelledby="hapcard-loading-title"
      data-testid="hapcard-loading-state"
      className="mx-auto flex w-full max-w-[520px] flex-col gap-3 pb-12"
    >
      <div className="rounded-[var(--r-xl)] border border-border bg-card px-5 py-6 text-center shadow-[var(--e-1)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--p-95)] text-primary">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
        <h1 id="hapcard-loading-title" className="font-h1 text-foreground break-keep">
          {t('title')}
        </h1>
        <p data-testid="hapcard-loading-estimate" className="font-sub mt-2 text-muted-foreground break-keep">
          {t('estimate')}
        </p>
      </div>

      <div
        role="status"
        aria-live="polite"
        data-testid="hapcard-loading-status"
        className="rounded-[var(--r-xl)] border border-border bg-card p-4 shadow-[var(--e-1)]"
      >
        <p className="font-eyebrow text-primary">{t('statusLabel')}</p>
        <p className="font-h2 mt-2 text-foreground break-keep">
          {t(`phases.${phaseKey}.title`)}
        </p>
        <p className="font-sub mt-2 text-muted-foreground break-keep">
          {t(`phases.${phaseKey}.body`)}
        </p>
      </div>

      <div className="rounded-[var(--r-xl)] bg-[var(--surface-1)] p-4">
        <p className="font-eyebrow text-[var(--on-surface-var)]">{t('readLabel')}</p>
        <p data-testid="hapcard-loading-note" className="font-body mt-2 text-foreground break-keep">
          {t(`phases.${phaseKey}.note`)}
        </p>
      </div>

      {isLongWait && (
        <div
          data-testid="hapcard-loading-long-wait"
          className="rounded-[var(--r-xl)] bg-[var(--info-bg)] p-4"
        >
          <p className="font-h3 text-[var(--info)] break-keep">{t('longWait.title')}</p>
          <p className="font-sub mt-1 text-[var(--info)] break-keep">{t('longWait.body')}</p>
        </div>
      )}

      <div data-testid="hapcard-skeleton" className="space-y-3" aria-hidden="true">
        <div className="h-10 animate-pulse rounded-[var(--r-md)] bg-card" />
        <div className="h-40 animate-pulse rounded-[var(--r-xl)] bg-card" />
        <div className="h-24 animate-pulse rounded-[var(--r-xl)] bg-card" />
      </div>
    </section>
  );
}
