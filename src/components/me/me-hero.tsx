'use client';

import { useTranslations } from 'next-intl';
import { pillarDescriptor } from '@/lib/saju/pillarDescriptor';
import { IljuChip } from '@/components/hapcard/primitives/ilju-chip';
import type { ChartCore } from '@/types/chart';

interface MeHeroProps {
  chart: ChartCore;
}

const { hanja: ILJU_HANJA } = pillarDescriptor('일');

export function MeHero({ chart }: MeHeroProps) {
  const t = useTranslations('me.hero');
  return (
    <div data-testid="me-hero" className="flex flex-col items-center gap-2 py-6">
      <IljuChip pillar={chart.day_pillar} element={chart.day_master_element} />
      <p title={ILJU_HANJA} className="text-xs text-muted-foreground">{t('eyebrow')}</p>
    </div>
  );
}
