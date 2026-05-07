'use client';

import { useTranslations } from 'next-intl';
import type { ChartCore } from '@/types/chart';

interface DayMasterCardProps {
  element: ChartCore['day_master_element'];
}

export function DayMasterCard({ element }: DayMasterCardProps) {
  const t = useTranslations('me.section.daymaster');
  return (
    <div data-testid="day-master-card" className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{t('eyebrow')}</p>
      <p className="text-sm text-foreground">{t(element)}</p>
    </div>
  );
}
