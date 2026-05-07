'use client';

import { useTranslations } from 'next-intl';
import type { YunseCore } from '@/types/chart';

type YunseCardProps = {
  yunse: YunseCore;
};

export default function YunseCard({ yunse }: YunseCardProps) {
  const t = useTranslations('me.section.yunse');

  return (
    <section
      data-testid="yunse-card"
      className="rounded-2xl border border-border bg-card p-4 space-y-4"
    >
      <header className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{t('title')}</p>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t('daeun.label')}</p>
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {yunse.daeun.list.map((seg, idx) => {
            const isCurrent = idx === yunse.daeun.current_index;
            return (
              <li
                key={`${seg.age}-${seg.year}`}
                aria-current={isCurrent ? 'true' : undefined}
                className={`flex min-w-[3.5rem] flex-col items-center gap-1 rounded-xl border px-3 py-2 text-center ${
                  isCurrent
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <span className="text-[10px]">{seg.age}</span>
                <span className="text-sm font-semibold">{seg.pillar}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <dl className="space-y-2">
        <div className="flex items-center justify-between">
          <dt className="text-xs text-muted-foreground">{t('seyun.label')}</dt>
          <dd className="text-sm font-semibold text-foreground">{yunse.seyun.current_pillar}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-xs text-muted-foreground">{t('wolun.label')}</dt>
          <dd className="text-sm font-semibold text-foreground">{yunse.wolun.current_pillar}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-xs text-muted-foreground">{t('iliun.label')}</dt>
          <dd className="text-sm font-semibold text-foreground">{yunse.iliun.today_pillar}</dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">{t('interpretationFooter')}</p>
    </section>
  );
}
