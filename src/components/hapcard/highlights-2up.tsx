'use client';

import { useTranslations } from 'next-intl';

interface WhyCard {
  title: string;
  reason: string;
}

interface HapcardHighlights2UpProps {
  cards: WhyCard[];
}

export function HapcardHighlights2Up({ cards }: HapcardHighlights2UpProps) {
  const t = useTranslations('hapcard');

  if (cards.length === 0) return null;

  const strength = cards[0];
  const warning = cards.length >= 2 ? cards[cards.length - 1] : null;

  return (
    <div
      data-testid="hapcard-highlights-2up"
      className={warning ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2'}
    >
      <div
        data-testid="hapcard-highlights-strength"
        className="rounded-2xl bg-semantic-ok-bg p-3 flex flex-col gap-0.5"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-semantic-ok">
          {t('highlights.strengthLabel')}
        </p>
        <h3 className="text-[15px] font-semibold leading-snug text-semantic-ok">
          {strength.title}
        </h3>
        <p className="text-[11px] leading-snug text-semantic-ok/80">
          {strength.reason}
        </p>
      </div>
      {warning && (
        <div
          data-testid="hapcard-highlights-warning"
          className="rounded-2xl bg-semantic-warn-bg p-3 flex flex-col gap-0.5"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-semantic-warn">
            {t('highlights.warningLabel')}
          </p>
          <h3 className="text-[15px] font-semibold leading-snug text-semantic-warn">
            {warning.title}
          </h3>
          <p className="text-[11px] leading-snug text-semantic-warn/80">
            {warning.reason}
          </p>
        </div>
      )}
    </div>
  );
}
