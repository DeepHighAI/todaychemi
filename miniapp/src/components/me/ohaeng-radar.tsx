/**
 * ohaeng-radar.tsx — 오행 5축 레이더 + 인사이트 칩 (Phase 4 데이터 비주얼)
 *
 * 와이어 ref: UIDesign/SAJU-handoff/src/components/me/ohaeng-radar.tsx
 * 미니앱 적응:
 *   - --el-* → --accent-* 토큰(미니앱 토큰 체계, me-hero Dawn 과 동일 매핑)
 *   - 한자 미노출(ADR-038): 한글 원소 라벨만(레퍼런스의 hanja 칩 미포팅)
 *   - 인사이트 칩 = 중립 라벨 '가장 강한/약한 기운'(§1.1 2026-06-21).
 *     레퍼런스는 최소 원소를 '희신'으로 라벨하나 희신은 억부 용신의 산물이라
 *     최소 원소와 다름 → 도메인 단정 회피(ADR-018 모트).
 *   - SectionCard 카드 언어로 래핑(PillarGrid/DayMasterCard 와 동일).
 */

import { useTranslations } from 'next-intl';

import { SectionCard } from '@/components/me/section-card';
import { toPercent } from '@/lib/hapcard/ohaeng-percent';
import type { OhaengElement } from '@/lib/saju/elementLabel';

const ELEMENTS: OhaengElement[] = ['목', '화', '토', '금', '수'];
const N = ELEMENTS.length;

const KEY_TO_EN: Record<OhaengElement, 'wood' | 'fire' | 'earth' | 'metal' | 'water'> = {
  목: 'wood',
  화: 'fire',
  토: 'earth',
  금: 'metal',
  수: 'water',
};

const SIZE = 160;
const CX = 80;
const CY = 80;
const R_MAX = 54;

// index 번째 꼭짓점(scale 0~1) 좌표 — 12시 방향에서 시계방향.
function vertex(index: number, scale: number): [number, number] {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / N;
  return [CX + scale * R_MAX * Math.cos(angle), CY + scale * R_MAX * Math.sin(angle)];
}

interface OhaengRadarProps {
  data: Record<OhaengElement, number>;
}

export function OhaengRadar({ data }: OhaengRadarProps) {
  const t = useTranslations('me.section.ohaeng');
  const pct = toPercent(data);

  // 가장 강한/약한 기운 = 최다/최소 카운트 원소(중립 표현, 명리 단정 아님).
  const values = ELEMENTS.map((e) => data[e] ?? 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const strongest = ELEMENTS.find((e) => (data[e] ?? 0) === max) ?? '목';
  const weakest = ELEMENTS.find((e) => (data[e] ?? 0) === min) ?? '화';

  const gridLevels = [0.33, 0.66, 1].map((lv) =>
    ELEMENTS.map((_, i) => vertex(i, lv).join(',')).join(' '),
  );
  const fillPoints = ELEMENTS.map((el, i) => vertex(i, (pct[el] ?? 0) / 100).join(',')).join(' ');

  return (
    <SectionCard eyebrow={t('eyebrow')} data-testid="ohaeng-radar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: SIZE, flexShrink: 0 }}>
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label="오행 오각맵"
            style={{ width: '100%', height: 'auto' }}
          >
            {gridLevels.map((points, i) => (
              <polygon key={i} points={points} fill="none" stroke="var(--hairline)" strokeWidth={1} />
            ))}
            <polygon
              points={fillPoints}
              fill="var(--p-40)"
              fillOpacity={0.18}
              stroke="var(--p-40)"
              strokeWidth={1.5}
            />
            {ELEMENTS.map((el, i) => {
              const [x, y] = vertex(i, 1.25);
              const en = KEY_TO_EN[el];
              return (
                <g key={el}>
                  <circle
                    cx={x}
                    cy={y}
                    r={10}
                    fill="var(--bg-card)"
                    stroke={`var(--accent-${en})`}
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    style={{ font: '700 11px/1 var(--font-display)', fill: `var(--accent-${en})` }}
                  >
                    {el}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <InsightChip el={strongest} count={data[strongest] ?? 0} label={t('strongest')} />
          <InsightChip el={weakest} count={data[weakest] ?? 0} label={t('weakest')} />
        </div>
      </div>
    </SectionCard>
  );
}

function InsightChip({ el, count, label }: { el: OhaengElement; count: number; label: string }) {
  const en = KEY_TO_EN[el];
  return (
    <div style={{ borderRadius: 10, padding: '8px 10px', background: `var(--accent-${en}-soft)` }}>
      <span
        style={{
          font: 'var(--t-eyebrow)',
          letterSpacing: 'var(--ls-wide)',
          color: `var(--accent-${en})`,
        }}
      >
        {label}
      </span>
      <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 13, lineHeight: 1.3, color: 'var(--text-primary)' }}>
        {el} · {count}
      </p>
    </div>
  );
}
