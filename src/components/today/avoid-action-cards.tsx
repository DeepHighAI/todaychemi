'use client';

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';
import type { DailyHapCard } from '@/types/dailyHap';

interface AvoidActionCardsProps {
  card: DailyHapCard;
}

export function AvoidActionCards({ card }: AvoidActionCardsProps) {
  const t = useTranslations('home');
  return (
    <div className="grid grid-cols-1 gap-3 px-4">
      <div data-card="avoid" className="bg-surface-2 rounded-[var(--r-lg)] p-4 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{t('avoid_phrase_label')}</p>
        <p className="text-base font-bold text-foreground">{convertHanja(card.avoid_phrase)}</p>
        <p className="text-sm text-muted-foreground">{convertHanja(card.avoid_phrase_reason)}</p>
      </div>
      <div data-card="favorable" className="bg-surface-2 rounded-[var(--r-lg)] p-4 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{t('favorable_action_label')}</p>
        <p className="text-base font-bold text-foreground">{convertHanja(card.favorable_action)}</p>
        <p className="text-sm text-muted-foreground">{convertHanja(card.favorable_action_reason)}</p>
      </div>
    </div>
  );
}
