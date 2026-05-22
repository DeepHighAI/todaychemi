'use client';

/* TodayHero — Liquid Glass hero with score signature
 * Canvas reference: type-d/screens-interactive.jsx::IHome (Liquid Glass hero section)
 *
 * Improvements over original:
 *  - 56px score number (vs. text-only headline)
 *  - "+N vs 어제" delta pill
 *  - Tap → /hapcard or /feed
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';
import { formatTemperatureDelta, scoreToTemperature } from '@/lib/scoring/temperature';
import type { DailyHapCard } from '@/types/dailyHap';

interface TodayHeroProps {
  card: DailyHapCard;
  score?: number | null;
  deltaVsYesterday?: number | null;
}

export function TodayHero({ card, score, deltaVsYesterday }: TodayHeroProps) {
  const t = useTranslations('home');
  const hasScore = typeof score === 'number';
  const temperature = hasScore ? scoreToTemperature(score) : null;

  return (
    <Link
      href="/feed"
      className="bg-liquid-hero rounded-[var(--r-xl)] mx-4 p-5 space-y-3 block relative overflow-hidden active:scale-[0.99] transition-transform"
      aria-label={t('greeting')}
    >
      {/* gloss overlay (matches canvas .liquid::before) */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.30), transparent 50%)' }}
      />

      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-white/85 uppercase tracking-[0.08em]">
            {t('greeting')}
          </p>
          {hasScore ? (
            <p className="font-display font-black text-[56px] leading-none tracking-[-0.045em] text-white mt-1.5 tabular-nums">
              {temperature?.toFixed(1)}
              <span className="text-[18px] font-bold text-white/85 ml-1 tracking-normal align-baseline">°C</span>
            </p>
          ) : (
            <p className="font-display font-extrabold text-[28px] leading-[1.18] tracking-[-0.025em] text-white mt-2 whitespace-pre-line">
              {convertHanja(card.headline)}
            </p>
          )}
        </div>

        {typeof deltaVsYesterday === 'number' && deltaVsYesterday !== 0 && (
          <span className="shrink-0 inline-flex items-center bg-white/20 text-white text-[11px] font-bold leading-[1.3] rounded-full px-2.5 py-1 whitespace-nowrap">
            {deltaVsYesterday > 0 ? '▲' : '▼'} {formatTemperatureDelta(deltaVsYesterday)} vs {t('yesterday')}
          </span>
        )}
      </div>

      <p className="relative z-[1] text-sm text-white/85 leading-[1.45]">
        {convertHanja(card.headline_reason)}
      </p>

      {card.reused_from_yesterday && (
        <span className="relative z-[1] inline-block bg-white/20 text-white text-xs font-medium rounded-full px-3 py-1">
          {t('reused_label')}
        </span>
      )}
    </Link>
  );
}
