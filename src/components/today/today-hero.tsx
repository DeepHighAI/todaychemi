'use client';

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';
import type { DailyHapCard } from '@/types/dailyHap';

interface TodayHeroProps {
  card: DailyHapCard;
}

export function TodayHero({ card }: TodayHeroProps) {
  const t = useTranslations('home');
  return (
    <div className="bg-liquid-hero rounded-[var(--r-xl)] mx-4 p-6 space-y-3">
      <p className="text-xs font-semibold text-white/70 uppercase tracking-widest">
        {t('greeting')}
      </p>
      <p className="font-display font-black text-[56px] leading-none tracking-[-0.04em] text-white">
        {convertHanja(card.headline)}
      </p>
      <p className="text-sm text-white/85">{convertHanja(card.headline_reason)}</p>
      {card.reused_from_yesterday && (
        <span className="inline-block bg-white/20 text-white text-xs font-medium rounded-full px-3 py-1">
          {t('reused_label')}
        </span>
      )}
    </div>
  );
}
