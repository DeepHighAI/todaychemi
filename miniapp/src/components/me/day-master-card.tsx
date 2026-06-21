/**
 * day-master-card.tsx — 일간(日干) 설명 카드 (미니앱 포트)
 *
 * 웹앱 원본: src/components/me/day-master-card.tsx
 * 미니앱: Tailwind → 인라인 스타일.
 */

import { useTranslations } from 'next-intl';
import { elementLabel } from '@/lib/saju/elementLabel';
import { SectionCard } from '@/components/me/section-card';
import type { ChartCore } from '@/types/chart';

interface DayMasterCardProps {
  element: ChartCore['day_master_element'];
}

export function DayMasterCard({ element }: DayMasterCardProps) {
  const t = useTranslations('me.section.daymaster');
  const { hanja } = elementLabel(element);
  return (
    <SectionCard eyebrow={t('eyebrow')} gap={8} data-testid="day-master-card">
      <p title={hanja} style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>
        {t(element)}
      </p>
    </SectionCard>
  );
}
