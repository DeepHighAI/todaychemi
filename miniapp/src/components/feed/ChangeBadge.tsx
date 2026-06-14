/**
 * ChangeBadge.tsx — 흐름 변화 큼 배지 (미니앱 포트)
 *
 * 웹앱 원본: src/components/feed/ChangeBadge.tsx
 * 변경: 'use client' 제거, next-intl → useTranslations (provider 마운트됨).
 */

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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 'var(--r-pill)',
        backgroundColor: '#fef3c7',
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 600,
        color: '#92400e',
      }}
    >
      {t('badge.change_significant', { delta })}
    </span>
  );
}
