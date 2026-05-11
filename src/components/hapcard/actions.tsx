'use client';

import { useTranslations } from 'next-intl';

interface HapcardActionsProps {
  actions: string[];
}

export function HapcardActions({ actions }: HapcardActionsProps) {
  const t = useTranslations('hapcard');
  if (actions.length === 0) {
    return (
      <div data-testid="hapcard-actions" className="rounded-2xl bg-card p-6">
        <p className="font-sub text-muted-foreground">{t('actionsList.empty')}</p>
      </div>
    );
  }

  return (
    <div data-testid="hapcard-actions" className="space-y-2">
      {actions.map((action, i) => (
        <div
          key={i}
          className={
            i === 0
              ? 'rounded-2xl bg-primary/10 border border-primary/20 p-4 space-y-1.5'
              : 'rounded-2xl bg-card border border-border p-4 space-y-1.5'
          }
        >
          <p className="font-eyebrow text-primary">{i + 1}</p>
          <p className={i === 0 ? 'font-h3 text-foreground' : 'font-body text-foreground'}>
            {action}
          </p>
        </div>
      ))}
    </div>
  );
}
