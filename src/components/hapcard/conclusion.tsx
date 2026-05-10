'use client';

import { useTranslations } from 'next-intl';
import { extractConclusion } from '@/lib/hapcard/extract-conclusion';

interface HapcardConclusionProps {
  mainText: string;
}

export function HapcardConclusion({ mainText }: HapcardConclusionProps) {
  const t = useTranslations('hapcard');
  const conclusion = extractConclusion(mainText);
  return (
    <div data-testid="hapcard-conclusion" className="rounded-2xl bg-card p-6 space-y-1">
      <p
        data-testid="conclusion-eyebrow"
        className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
      >
        {t('conclusion.eyebrow')}
      </p>
      <h2 className="text-lg font-bold text-foreground leading-snug text-balance">
        {conclusion}
      </h2>
    </div>
  );
}
