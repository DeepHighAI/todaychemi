'use client';

import { useTranslations } from 'next-intl';

interface HapcardBodyProps {
  mainText: string;
}

export function HapcardBody({ mainText }: HapcardBodyProps) {
  const t = useTranslations('hapcard');
  return (
    <div data-testid="hapcard-body" className="rounded-2xl bg-card p-6 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {t('body.eyebrow')}
      </p>
      <p className="text-base font-semibold text-foreground text-balance whitespace-pre-line">
        {mainText}
      </p>
    </div>
  );
}
