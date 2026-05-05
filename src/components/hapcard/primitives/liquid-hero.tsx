import type { ReactNode } from 'react';
import type { ScoreTier } from '@/lib/hapcard/score-tier';

const tierLabel: Record<ScoreTier, string> = {
  weak: '약함',
  fair: '보통',
  good: '좋음',
  great: '매우 좋음',
};

interface LiquidHeroProps {
  score: number;
  tier: ScoreTier;
  children?: ReactNode;
}

export function LiquidHero({ score, tier, children }: LiquidHeroProps) {
  return (
    <div className="bg-liquid-hero rounded-2xl p-6 text-white text-center space-y-2">
      <p className="text-6xl font-bold">{score}</p>
      <p className="text-sm font-medium opacity-90">{tierLabel[tier]}</p>
      {children}
    </div>
  );
}
