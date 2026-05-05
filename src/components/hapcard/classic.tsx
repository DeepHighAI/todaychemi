'use client';

import { useTranslations } from 'next-intl';

interface Citation {
  source: string;
  original: string;
  modern: string;
}

interface HapcardClassicProps {
  citations: Citation[];
}

export function HapcardClassic({ citations }: HapcardClassicProps) {
  const t = useTranslations('hapcard');
  return (
    <div data-testid="hapcard-classic" className="rounded-2xl bg-card p-6 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t('classicList.title')}</p>
      {citations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('classicList.empty')}</p>
      ) : (
        <ul className="space-y-4">
          {citations.map((c, i) => (
            <li key={i} className="border border-border rounded-xl p-3 space-y-1">
              <p className="text-xs font-medium text-primary">{c.source}</p>
              <p className="text-sm text-foreground italic">{c.original}</p>
              <p className="text-xs text-muted-foreground">{c.modern}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
