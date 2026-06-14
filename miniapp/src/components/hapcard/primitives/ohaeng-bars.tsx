/**
 * ohaeng-bars.tsx — 오행 분포 바 차트 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/primitives/ohaeng-bars.tsx
 * 미니앱: Tailwind → 인라인 스타일, tokens.css --accent-* 변수 사용.
 */

import { toPercent } from '@/lib/hapcard/ohaeng-percent';
import { elementLabel, type OhaengElement } from '@/lib/saju/elementLabel';

const ELEMENTS: OhaengElement[] = ['목', '화', '토', '금', '수'];

interface OhaengBarsProps {
  data: Record<OhaengElement, number>;
}

const BAR_MAX_PX = 48;

export function OhaengBars({ data }: OhaengBarsProps) {
  const percents = toPercent(data);
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
      {ELEMENTS.map((el) => {
        const { hanja, color } = elementLabel(el);
        const pct = Math.round(percents[el]);
        return (
          <div
            key={el}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
          >
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={el}
              title={hanja}
              style={{
                height: `${Math.round(pct * BAR_MAX_PX / 100)}px`,
                width: '100%',
                borderRadius: 4,
                backgroundColor: color,
                minHeight: 2,
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{el}</span>
          </div>
        );
      })}
    </div>
  );
}
