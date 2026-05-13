'use client';

import { useTranslations } from 'next-intl';
import { scoreToTier } from '@/lib/hapcard/score-tier';
import { LiquidHero } from './primitives/liquid-hero';

interface ScoreBreakdown {
  hap_chung_hyung_hae: number;
  sipsin: number;
  ohaeng: number;
  mode_adjustment: number;
}

interface HapcardGaugeProps {
  score: number;
  breakdown: ScoreBreakdown;
}

export function HapcardGauge({ score, breakdown }: HapcardGaugeProps) {
  const t = useTranslations('hapcard');
  const tier = scoreToTier(score);
  return (
    <div data-testid="hapcard-gauge">
      <LiquidHero score={score} tier={tier}>
        <p className="text-xs opacity-75">
          {t('gauge.breakdown', {
            h: Math.round(breakdown.hap_chung_hyung_hae),
            s: Math.round(breakdown.sipsin),
            o: Math.round(breakdown.ohaeng),
            m: Math.round(breakdown.mode_adjustment),
          })}
        </p>
      </LiquidHero>
    </div>
  );
}
