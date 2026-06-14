/**
 * day-master-card.tsx — 일간(日干) 설명 카드 (미니앱 포트)
 *
 * 웹앱 원본: src/components/me/day-master-card.tsx
 * 미니앱: Tailwind → 인라인 스타일.
 */

import { useTranslations } from 'next-intl';
import { elementLabel } from '@/lib/saju/elementLabel';
import type { ChartCore } from '@/types/chart';

interface DayMasterCardProps {
  element: ChartCore['day_master_element'];
}

export function DayMasterCard({ element }: DayMasterCardProps) {
  const t = useTranslations('me.section.daymaster');
  const { hanja } = elementLabel(element);
  return (
    <div
      data-testid="day-master-card"
      style={{
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--hairline)',
        backgroundColor: 'var(--bg-card)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>
        {t('eyebrow')}
      </p>
      <p title={hanja} style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>
        {t(element)}
      </p>
    </div>
  );
}
