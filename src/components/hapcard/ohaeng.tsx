'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { elementLabel, type OhaengElement } from '@/lib/saju/elementLabel';
import type { OhaengInterpretation } from '@/types/hapcard';

const ELEMENTS: OhaengElement[] = ['목', '화', '토', '금', '수'];

interface HapcardOhaengProps {
  userCounts: Record<OhaengElement, number>;
  relationCounts: Record<OhaengElement, number>;
  hapcardId?: string;
  interpretation?: OhaengInterpretation;
}

interface ComparisonBarProps {
  label: string;
  value: number;
  scaleMax: number;
  colorClass: string;
  side: 'left' | 'right';
}

function ComparisonBar({ label, value, scaleMax, colorClass, side }: ComparisonBarProps) {
  const width = Math.round((value / scaleMax) * 100);
  const alignClass = side === 'left' ? 'ml-auto' : '';

  return (
    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted/70">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={scaleMax}
        className={`h-full rounded-full ${colorClass} ${alignClass}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

async function fetchOhaengInterpretation(hapcardId: string): Promise<OhaengInterpretation> {
  const res = await fetch(`/api/hapcards/${hapcardId}/ohaeng-interpretation`);
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
}: HapcardOhaengProps) {
  const t = useTranslations('hapcard');
  const shouldFetchInterpretation = !!hapcardId && !interpretation;
  const interpretationQuery = useQuery({
    queryKey: ['hapcard-ohaeng-interpretation', hapcardId],
    queryFn: () => fetchOhaengInterpretation(hapcardId!),
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
    <div data-testid="hapcard-ohaeng" className="rounded-2xl bg-card p-5 space-y-4">
      <p className="text-sm font-semibold text-foreground">{t('ohaeng.title')}</p>
      <div data-testid="ohaeng-comparison-chart" className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] gap-2 text-[11px] font-semibold text-muted-foreground">
          <span className="text-right">{t('ohaeng.labelMe')}</span>
          <span aria-hidden="true" />
          <span>{t('ohaeng.labelRelation')}</span>
        </div>
        {ELEMENTS.map((element) => {
          const { color_class } = elementLabel(element);
          const userValue = userCounts[element] ?? 0;
          const relationValue = relationCounts[element] ?? 0;

          return (
            <div
              key={element}
              data-testid={`ohaeng-row-${element}`}
              className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-center gap-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-right text-[11px] font-semibold text-muted-foreground">
                  {userValue}
                </span>
                <ComparisonBar
                  label={`${t('ohaeng.labelMe')} ${element} ${userValue}`}
                  value={userValue}
                  scaleMax={scaleMax}
                  colorClass={color_class}
                  side="left"
                />
              </div>
              <span className="rounded-full bg-background px-2 py-1 text-center text-xs font-bold text-foreground">
                {element}
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <ComparisonBar
                  label={`${t('ohaeng.labelRelation')} ${element} ${relationValue}`}
                  value={relationValue}
                  scaleMax={scaleMax}
                  colorClass={color_class}
                  side="right"
                />
                <span className="w-4 shrink-0 text-[11px] font-semibold text-muted-foreground">
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
          className="rounded-[var(--r-md)] bg-[var(--surface-1)] p-4 space-y-3"
        >
          <div className="space-y-1.5">
            <p className="text-[13px] font-extrabold text-primary">
              {resolvedInterpretation?.title ?? t('ohaeng.interpretation.title')}
            </p>
            {resolvedInterpretation ? (
              <p className="text-[14px] leading-[1.65] font-semibold text-foreground">
                {resolvedInterpretation.summary}
              </p>
            ) : (
              <p className="text-[13px] leading-[1.6] font-semibold text-muted-foreground">
                {interpretationQuery.isError
                  ? t('ohaeng.interpretation.error')
                  : t('ohaeng.interpretation.loading')}
              </p>
            )}
          </div>
          {resolvedInterpretation && (
            <>
              <div className="space-y-2.5">
                {resolvedInterpretation.points.map((point) => (
                  <p key={point.label} className="text-[13px] leading-[1.65] text-foreground">
                    <strong className="font-extrabold text-foreground">{point.label}</strong>
                    <span aria-hidden className="font-extrabold text-primary"> = </span>
                    <span>{point.body}</span>
                  </p>
                ))}
              </div>
              <p className="rounded-[12px] bg-primary/10 px-3 py-2.5 text-[13px] leading-[1.6] font-semibold text-primary">
                {resolvedInterpretation.tip}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
