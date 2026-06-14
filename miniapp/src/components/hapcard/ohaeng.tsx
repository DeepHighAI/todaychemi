/**
 * ohaeng.tsx — 오행 흐름 비교 섹션 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/ohaeng.tsx
 * 변경: Tailwind → 인라인 스타일, 'use client' 제거, fetch → apiFetch.
 * apiFetch 는 Authorization 헤더를 자동 첨부하므로 token prop 불필요 (AuthProvider 에서 토큰 주입 불가 —
 * apiFetch 는 singleton base URL 래퍼라 훅에서 토큰 접근 불가. 이 컴포넌트는 인증 쿠키 없이 Bearer 필요 없는 읽기 전용 경로.
 * TODO(P5): HapcardView 에서 token 을 Context/prop 으로 전달해 apiFetch options 에 주입할 것.
 */

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
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
  const width = Math.round((value / scaleMax) * 100);
  const marginLeft = side === 'left' ? 'auto' : undefined;

  return (
    <div style={{ height: 10, flex: 1, overflow: 'hidden', borderRadius: 'var(--r-pill)', backgroundColor: 'rgba(0,0,0,0.08)' }}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={scaleMax}
        style={{
          height: '100%',
          borderRadius: 'var(--r-pill)',
          backgroundColor: ELEMENT_COLOR[element],
          width: `${width}%`,
          marginLeft,
        }}
      />
    </div>
  );
}

async function fetchOhaengInterpretation(hapcardId: string, token?: string | null): Promise<OhaengInterpretation> {
  // apiFetch를 사용하지 않고 직접 fetch — 이 경로는 현재 Bearer 인증이 선택 사항
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'https://todaychemi.vercel.app';
  const res = await fetch(`${base}/api/hapcards/${hapcardId}/ohaeng-interpretation`, { headers });
  if (!res.ok) throw new Error('OHAENG_INTERPRETATION_FETCH_FAILED');
  const body = await res.json() as { interpretation?: OhaengInterpretation };
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
