'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { formatTemperatureDelta } from '@/lib/scoring/temperature';
import type { HapcardChangeResponse } from '@/types/hapcard';

interface Props {
  hapcardId: string;
}

async function fetchChange(hapcardId: string): Promise<HapcardChangeResponse> {
  const res = await fetch(`/api/hapcards/${hapcardId}/change`);
  if (!res.ok) throw new Error('change_fetch_failed');
  return res.json() as Promise<HapcardChangeResponse>;
}

// 부호 있는 원점수 표기 (요인 변화량) — §1.1 2026-06-13 확정 형식
function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function HapcardChangeIndicator({ hapcardId }: Props) {
  const t = useTranslations('hapcard.changeIndicator');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hapcard-change', hapcardId],
    queryFn: () => fetchChange(hapcardId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div
        data-testid="hapcard-change-skeleton"
        role="status"
        aria-label={t('loading')}
        className="rounded-2xl bg-card p-4 space-y-2 animate-pulse"
      >
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="h-5 w-20 rounded bg-muted" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        data-testid="hapcard-change"
        role="alert"
        className="rounded-2xl bg-card p-4 text-sm text-muted-foreground text-center"
      >
        {t('error')}
      </div>
    );
  }

  // 비교 불가(first / version_changed) → 안내 문구만 (변화 자리는 항상 유지, §1.1)
  if (data.status !== 'comparable') {
    const message = data.status === 'first' ? t('first') : t('versionChanged');
    return (
      <div data-testid="hapcard-change" className="rounded-2xl bg-card p-4 space-y-1">
        <p className="font-eyebrow text-muted-foreground">{t('title')}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  const delta = data.delta ?? 0;
  const direction = delta > 0 ? t('up') : delta < 0 ? t('down') : t('same');
  const deltaColor =
    delta > 0 ? 'text-[var(--ok)]' : delta < 0 ? 'text-[var(--warn)]' : 'text-muted-foreground';

  return (
    <div data-testid="hapcard-change" className="rounded-2xl bg-card p-4 space-y-3">
      <p className="font-eyebrow text-muted-foreground">{t('title')}</p>

      <div data-testid="hapcard-change-delta" className="flex items-baseline gap-2">
        <span className={`font-display font-extrabold text-xl tabular-nums ${deltaColor}`}>
          {formatTemperatureDelta(delta)}
        </span>
        <span className={`text-sm font-bold ${deltaColor}`}>{direction}</span>
      </div>

      {data.factors.length > 0 && (
        <ul className="space-y-1.5">
          {data.factors.map((entry) => {
            const factorColor =
              entry.delta > 0 ? 'text-[var(--ok)]' : 'text-[var(--warn)]';
            return (
              <li
                key={entry.factor}
                data-testid="hapcard-change-factor"
                className="flex items-center justify-between text-sm"
              >
                <span className="text-foreground">{t(`factor.${entry.factor}`)}</span>
                <span className={`font-medium tabular-nums ${factorColor}`}>
                  {signed(entry.delta)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
