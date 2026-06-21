/**
 * mini-radar.tsx — 합카드 오행 오버레이 레이더 래퍼 (본인 vs 인연 범례)
 *
 * 웹앱 원본: src/components/hapcard/mini-radar.tsx (read-only ref)
 * 미니앱 적응: Tailwind → 인라인 스타일, color-mix 범례 칩.
 * 상위 '오행 흐름' 카드 안에 들어가므로 자체 타이틀은 렌더하지 않는다
 * (중복 회피) — 본인/인연 범례만 표시한다.
 */

import { useTranslations } from 'next-intl';

import { MiniRadar } from './primitives/mini-radar';
import type { OhaengElement } from '@/lib/saju/elementLabel';

interface HapcardMiniRadarProps {
  user: Record<OhaengElement, number>;
  relation: Record<OhaengElement, number>;
}

export function HapcardMiniRadar({ user, relation }: HapcardMiniRadarProps) {
  const t = useTranslations('hapcard.miniRadar');
  return (
    <div
      data-testid="hapcard-mini-radar"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}
    >
      <div style={{ width: '100%', maxWidth: 220 }}>
        <MiniRadar user={user} relation={relation} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: 'color-mix(in srgb, var(--primary) 40%, transparent)',
              border: '1px solid var(--primary)',
            }}
          />
          {t('labelMe')}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden
            style={{ width: 10, height: 10, borderRadius: 3, border: '1px dashed var(--text-secondary)' }}
          />
          {t('labelRelation')}
        </span>
      </div>
    </div>
  );
}
