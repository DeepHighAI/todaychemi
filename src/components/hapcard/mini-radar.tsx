'use client';

import { useTranslations } from 'next-intl';
import { MiniRadar } from './primitives/mini-radar';

type OhaengKey = '목' | '화' | '토' | '금' | '수';

interface HapcardMiniRadarProps {
  user: Record<OhaengKey, number>;
  relation: Record<OhaengKey, number>;
}

export function HapcardMiniRadar({ user, relation }: HapcardMiniRadarProps) {
  const t = useTranslations('hapcard.miniRadar');
  return (
    <div data-testid="hapcard-mini-radar" className="rounded-2xl bg-card p-6 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t('title')}</p>
      <div className="mx-auto w-full max-w-[220px]">
        <MiniRadar user={user} relation={relation} />
      </div>
      <div className="flex justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-sm bg-primary/40 border border-primary"
          />
          {t('labelMe')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-sm border border-dashed border-muted-foreground"
          />
          {t('labelRelation')}
        </span>
      </div>
    </div>
  );
}
