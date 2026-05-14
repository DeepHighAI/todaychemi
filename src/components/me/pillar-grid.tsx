'use client';

import { useTranslations } from 'next-intl';
import { pillarDescriptor, type PillarKey } from '@/lib/saju/pillarDescriptor';
import { convertHanja } from '@/lib/glossary/post-process';
import type { ChartCore } from '@/types/chart';

interface PillarGridProps { chart: ChartCore }

const PILLAR_KEYS: PillarKey[] = ['년', '월', '일', '시'];

export function PillarGrid({ chart }: PillarGridProps) {
  const t = useTranslations('me.section.bonmyeongsik');
  const values = [
    chart.year_pillar,
    chart.month_pillar ?? t('unknown'),
    chart.day_pillar,
    chart.hour_pillar ?? t('unknown'),
  ];
  return (
    <div data-testid="pillar-grid" className="grid grid-cols-4 gap-2 text-center">
      {PILLAR_KEYS.map((key, i) => {
        const { ko_short, hanja } = pillarDescriptor(key);
        return (
          <div key={key} className="space-y-1">
            <p title={hanja} className="text-xs text-muted-foreground">{ko_short}</p>
            <p className="text-sm font-semibold">{values[i] ? convertHanja(values[i]) : '—'}</p>
          </div>
        );
      })}
    </div>
  );
}
