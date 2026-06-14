/**
 * me-hero.tsx — 본명식 히어로 (일주 칩 + 레이블) (미니앱 포트)
 *
 * 웹앱 원본: src/components/me/me-hero.tsx
 * 미니앱: Tailwind → 인라인 스타일, next-intl useTranslations 유지(provider 마운트됨).
 */

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
    <div
      data-testid="me-hero"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        paddingTop: 24,
        paddingBottom: 24,
      }}
    >
      <IljuChip pillar={chart.day_pillar} element={chart.day_master_element} />
      <p
        title={ILJU_HANJA}
        style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}
      >
        {t('eyebrow')}
      </p>
    </div>
  );
}
