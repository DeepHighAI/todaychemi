'use client';

import { useTranslations } from 'next-intl';

interface HapcardActionsProps {
  actions: string[];
}

export function HapcardActions({ actions }: HapcardActionsProps) {
  const t = useTranslations('hapcard');
  return (
    <div data-testid="hapcard-actions" className="rounded-2xl bg-primary/10 p-6 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t('actionsList.title')}</p>
      {actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('actionsList.empty')}</p>
      ) : (
        <ol className="space-y-2">
          {actions.map((action, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="text-sm font-bold text-primary">{i + 1}</span>
              <span className="text-sm text-foreground">{action}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
