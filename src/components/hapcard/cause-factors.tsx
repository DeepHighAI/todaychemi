'use client';

/* HapcardCauseFactors — 명리 근거(cause_factors) 표시 섹션
 * UIDesign wire: screens-result.jsx 의 "근거" 카드(번호 매긴 3-항목 리스트).
 * ADR-015: 명리 근거 항상 표시. ADR-038: name/effect 는 convertHanja() 안전망 필수.
 */

import { useTranslations } from 'next-intl';

import { convertHanja } from '@/lib/glossary/post-process';

interface CauseFactor {
  name: string;
  effect: string;
}

interface HapcardCauseFactorsProps {
  factors: CauseFactor[];
}

export function HapcardCauseFactors({ factors }: HapcardCauseFactorsProps) {
  const t = useTranslations('hapcard');

  return (
    <div data-testid="hapcard-cause-factors" className="rounded-2xl bg-card p-6 space-y-3">
      <p className="font-eyebrow text-primary">{t('causeFactors.title')}</p>
      {factors.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('causeFactors.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {factors.map((factor, index) => (
            <li key={index} className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] font-display text-[11px] font-extrabold text-primary"
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-body font-bold text-foreground">{convertHanja(factor.name)}</span>
                <span className="mt-0.5 block font-sub text-muted-foreground">{convertHanja(factor.effect)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
