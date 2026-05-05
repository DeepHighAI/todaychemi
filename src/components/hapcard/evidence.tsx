'use client';

import { useTranslations } from 'next-intl';

interface WhyCard {
  title: string;
  reason: string;
}

interface HapcardEvidenceProps {
  cards: WhyCard[];
}

export function HapcardEvidence({ cards }: HapcardEvidenceProps) {
  const t = useTranslations('hapcard');
  return (
    <div data-testid="hapcard-evidence" className="rounded-2xl bg-card p-6 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t('evidence.title')}</p>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('evidence.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {cards.map((card, i) => (
            <li key={i} className="border border-border rounded-xl p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">{card.title}</p>
              <p className="text-xs text-muted-foreground">{card.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
