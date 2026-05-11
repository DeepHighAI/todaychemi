'use client';

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';

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
        <p className="font-eyebrow text-semantic-ok">
          {t('highlights.strengthLabel')}
        </p>
        {/* LLM 출력 필드 — 한자 안전망 적용 */}
        <h3 className="font-h3 text-semantic-ok">
          {convertHanja(strength.title)}
        </h3>
        <p className="font-sub text-semantic-ok/80">
          {convertHanja(strength.reason)}
        </p>
      </div>
      {warning && (
        <div
          data-testid="hapcard-highlights-warning"
          className="rounded-2xl bg-semantic-warn-bg p-3 flex flex-col gap-0.5"
        >
          <p className="font-eyebrow text-semantic-warn">
            {t('highlights.warningLabel')}
          </p>
          {/* LLM 출력 필드 — 한자 안전망 적용 */}
          <h3 className="font-h3 text-semantic-warn">
            {convertHanja(warning.title)}
          </h3>
          <p className="font-sub text-semantic-warn/80">
            {convertHanja(warning.reason)}
          </p>
        </div>
      )}
    </div>
  );
}
