'use client';

import { useTranslations } from 'next-intl';
import { OhaengBars } from './primitives/ohaeng-bars';

type OhaengKey = '목' | '화' | '토' | '금' | '수';

interface HapcardOhaengProps {
  userCounts: Record<OhaengKey, number>;
  relationCounts: Record<OhaengKey, number>;
}

export function HapcardOhaeng({ userCounts, relationCounts }: HapcardOhaengProps) {
  const t = useTranslations('hapcard');
  return (
    <div data-testid="hapcard-ohaeng" className="rounded-2xl bg-card p-6 space-y-4">
      <p className="text-sm font-semibold text-foreground">{t('ohaeng.title')}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">{t('ohaeng.labelMe')}</p>
          <OhaengBars data={userCounts} />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">{t('ohaeng.labelRelation')}</p>
          <OhaengBars data={relationCounts} />
        </div>
      </div>
    </div>
  );
}
