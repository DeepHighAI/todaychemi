'use client';

import { useTranslations } from 'next-intl';
import { IljuChip } from './primitives/ilju-chip';

type OhaengElement = '목' | '화' | '토' | '금' | '수';

interface HapcardHeaderProps {
  mode: string;
  userPillar: string;
  userElement: OhaengElement;
  relationPillar: string;
  relationElement: OhaengElement;
}

export function HapcardHeader({
  mode,
  userPillar,
  userElement,
  relationPillar,
  relationElement,
}: HapcardHeaderProps) {
  const t = useTranslations('hapcard');
  return (
    <div data-testid="hapcard-header" className="flex items-center justify-center gap-3 py-4">
      <IljuChip pillar={userPillar} element={userElement} />
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-muted-foreground">{t('header.vs')}</span>
        <span className="text-xs font-medium text-foreground">{mode}</span>
      </div>
      <IljuChip pillar={relationPillar} element={relationElement} />
    </div>
  );
}
