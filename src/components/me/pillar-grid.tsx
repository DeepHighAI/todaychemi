'use client';

import { useTranslations } from 'next-intl';
import type { ChartCore } from '@/types/chart';

interface PillarGridProps { chart: ChartCore }

export function PillarGrid({ chart }: PillarGridProps) {
  const t = useTranslations('me.section.bonmyeongsik');
  const pillars = [
    { label: t('year'),  value: chart.year_pillar },
    { label: t('month'), value: chart.month_pillar ?? t('unknown') },
    { label: t('day'),   value: chart.day_pillar },
    { label: t('hour'),  value: chart.hour_pillar ?? t('unknown') },
  ];
  return (
    <div data-testid="pillar-grid" className="grid grid-cols-4 gap-2 text-center">
      {pillars.map(({ label, value }) => (
        <div key={label} className="space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}
