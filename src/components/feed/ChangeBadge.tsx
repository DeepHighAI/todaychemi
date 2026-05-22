'use client';

import { useTranslations } from 'next-intl';
import { formatTemperatureDelta } from '@/lib/scoring/temperature';

interface ChangeBadgeProps {
  significant: boolean;
  changeScore: number;
}

export function ChangeBadge({ significant, changeScore }: ChangeBadgeProps) {
  const t = useTranslations('feed');

  if (!significant) return null;

  const delta = formatTemperatureDelta(changeScore);

  return (
    <span
      data-testid="change-badge"
      className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
    >
      {t('badge.change_significant', { delta })}
    </span>
  );
}
