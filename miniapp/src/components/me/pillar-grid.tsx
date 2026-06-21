/**
 * pillar-grid.tsx — 사주 4기둥 그리드 (미니앱 포트)
 *
 * 웹앱 원본: src/components/me/pillar-grid.tsx
 * 미니앱: Tailwind → 인라인 스타일.
 * ADR-038: convertHanja() 경유.
 */

import { useTranslations } from 'next-intl';
import { pillarDescriptor, type PillarKey } from '@/lib/saju/pillarDescriptor';
import { convertHanja } from '@/lib/glossary/post-process';
import { SectionCard } from '@/components/me/section-card';
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
    <SectionCard eyebrow={t('eyebrow')}>
      <div
        data-testid="pillar-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}
      >
        {PILLAR_KEYS.map((key, i) => {
          const { ko_short, hanja } = pillarDescriptor(key);
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p
                title={hanja}
                style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}
              >
                {ko_short}
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                {values[i] ? convertHanja(values[i] as string) : '—'}
              </p>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
