'use client';

import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { pillarDescriptor } from '@/lib/saju/pillarDescriptor';
import { IljuChip } from '@/components/hapcard/primitives/ilju-chip';
import type { ChartCore } from '@/types/chart';

interface MeHeroProps {
  chart: ChartCore;
  onEditClick?: () => void;
}

const { hanja: ILJU_HANJA } = pillarDescriptor('일');

export function MeHero({ chart, onEditClick }: MeHeroProps) {
  const t = useTranslations('me.hero');
  return (
    <div data-testid="me-hero" className="relative flex flex-col items-center gap-2 py-6">
      <IljuChip pillar={chart.day_pillar} element={chart.day_master_element} />
      <p title={ILJU_HANJA} className="text-xs text-muted-foreground">{t('eyebrow')}</p>
      {onEditClick && (
        <button
          type="button"
          onClick={onEditClick}
          aria-label={t('edit.trigger')}
          className="absolute top-0 right-0 size-11 rounded-full bg-[var(--surface-2)] flex items-center justify-center"
        >
          <Pencil className="size-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
