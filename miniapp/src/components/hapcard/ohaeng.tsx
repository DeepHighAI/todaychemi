/**
 * ohaeng.tsx — 오행 흐름 비교 섹션 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/ohaeng.tsx
 * 변경: Tailwind → 인라인 스타일, 'use client' 제거, fetch → apiFetch.
 * 해석 라우트는 인증이 필요하므로 token prop 을 apiFetch options 로 전달한다
 * (HapcardPage → ExpandPanel 에서 주입).
 */

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { Bar } from '@/components/ui/bar';
import type { OhaengInterpretation } from '@/types/hapcard';

// 오행 요소 타입 (웹앱 src/lib/saju/elementLabel.ts 와 동일)
type OhaengElement = '목' | '화' | '토' | '금' | '수';

const ELEMENTS: OhaengElement[] = ['목', '화', '토', '금', '수'];

interface HapcardOhaengProps {
  userCounts: Record<OhaengElement, number>;
  relationCounts: Record<OhaengElement, number>;
  hapcardId?: string;
  interpretation?: OhaengInterpretation;
  /** 인증 Bearer 토큰 (인증 필요 라우트용) */
  token?: string | null;
}

interface ComparisonBarProps {
  label: string;
  value: number;
  scaleMax: number;
  element: OhaengElement;
  side: 'left' | 'right';
}

// 오행 컬러 맵 — Tailwind bg-element-* 클래스 대신 CSS 변수로 대응
const ELEMENT_COLOR: Record<OhaengElement, string> = {
  목: 'var(--accent-wood)',
  화: 'var(--accent-fire)',
  토: 'var(--accent-earth)',
  금: 'var(--accent-metal)',
  수: 'var(--accent-water)',
};

function ComparisonBar({ label, value, scaleMax, element, side }: ComparisonBarProps) {
  // side='left' 칸은 중앙(우측)으로 자라야 하므로 anchor='end'.
  return (
    <Bar
      value={value}
      max={scaleMax}
      color={ELEMENT_COLOR[element]}
      height={10}
      anchor={side === 'left' ? 'end' : 'start'}
      ariaLabel={label}
      style={{ flex: 1 }}
    />
  );
}

async function fetchOhaengInterpretation(hapcardId: string, token?: string | null): Promise<OhaengInterpretation> {
  const body = await apiFetch<{ interpretation?: OhaengInterpretation }>(
    `/api/hapcards/${hapcardId}/ohaeng-interpretation`,
    { token },
  );
  if (!body.interpretation) throw new Error('OHAENG_INTERPRETATION_EMPTY');
  return body.interpretation;
}

export function HapcardOhaeng({
  userCounts,
  relationCounts,
  hapcardId,
  interpretation,
  token,
}: HapcardOhaengProps) {
  const t = useTranslations('hapcard');
  const shouldFetchInterpretation = !!hapcardId && !interpretation;
  const interpretationQuery = useQuery({
    queryKey: ['hapcard-ohaeng-interpretation', hapcardId],
    queryFn: () => fetchOhaengInterpretation(hapcardId!, token),
    enabled: shouldFetchInterpretation,
    retry: false,
  });
  const resolvedInterpretation = interpretation ?? interpretationQuery.data;
  const shouldRenderInterpretation =
    !!resolvedInterpretation || shouldFetchInterpretation || interpretationQuery.isError;
  const scaleMax = Math.max(
    1,
    ...ELEMENTS.flatMap((element) => [userCounts[element] ?? 0, relationCounts[element] ?? 0]),
  );

  return (
    <div data-testid="hapcard-ohaeng" style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{t('ohaeng.title')}</p>
      <div data-testid="ohaeng-comparison-chart" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5rem 1fr', gap: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
          <span style={{ textAlign: 'right' }}>{t('ohaeng.labelMe')}</span>
          <span aria-hidden />
          <span>{t('ohaeng.labelRelation')}</span>
        </div>
        {ELEMENTS.map((element) => {
          const userValue = userCounts[element] ?? 0;
          const relationValue = relationCounts[element] ?? 0;
          return (
            <div
              key={element}
              data-testid={`ohaeng-row-${element}`}
              style={{ display: 'grid', gridTemplateColumns: '1fr 2.5rem 1fr', alignItems: 'center', gap: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ width: 16, flexShrink: 0, textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {userValue}
                </span>
                <ComparisonBar
                  label={`${t('ohaeng.labelMe')} ${element} ${userValue}`}
                  value={userValue}
                  scaleMax={scaleMax}
                  element={element}
                  side="left"
                />
              </div>
              <span style={{ borderRadius: 'var(--r-pill)', backgroundColor: 'var(--bg-canvas)', padding: '4px 8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                {element}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <ComparisonBar
                  label={`${t('ohaeng.labelRelation')} ${element} ${relationValue}`}
                  value={relationValue}
                  scaleMax={scaleMax}
                  element={element}
                  side="right"
                />
                <span style={{ width: 16, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {relationValue}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {shouldRenderInterpretation && (
        <div
          data-testid="ohaeng-interpretation"
          style={{ borderRadius: 'var(--r-md)', backgroundColor: 'var(--surface-1)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
              {resolvedInterpretation?.title ?? t('ohaeng.interpretation.title')}
            </p>
            {resolvedInterpretation ? (
              <p style={{ fontSize: 14, lineHeight: 1.65, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {resolvedInterpretation.summary}
              </p>
            ) : (
              <p style={{ fontSize: 13, lineHeight: 1.6, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                {interpretationQuery.isError
                  ? t('ohaeng.interpretation.error')
                  : t('ohaeng.interpretation.loading')}
              </p>
            )}
          </div>
          {resolvedInterpretation && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {resolvedInterpretation.points.map((point) => (
                  <p key={point.label} style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)', margin: 0 }}>
                    <strong style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{point.label}</strong>
                    <span aria-hidden style={{ fontWeight: 800, color: 'var(--primary)' }}> = </span>
                    <span>{point.body}</span>
                  </p>
                ))}
              </div>
              <p style={{ borderRadius: 12, backgroundColor: 'rgba(103,80,164,0.1)', padding: '10px 12px', fontSize: 13, lineHeight: 1.6, fontWeight: 600, color: 'var(--primary)', margin: 0 }}>
                {resolvedInterpretation.tip}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
