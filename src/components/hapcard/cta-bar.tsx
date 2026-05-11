'use client';

import { useTranslations } from 'next-intl';

interface HapcardCtaBarProps {
  onAction: () => void;
  onShare: () => void;
}

export function HapcardCtaBar({ onAction, onShare }: HapcardCtaBarProps) {
  const t = useTranslations('hapcard.ctaBar');

  return (
    <div
      data-testid="hapcard-cta-bar"
      role="region"
      aria-label="합카드 액션"
      className="fixed left-0 right-0 z-40 px-4 py-3 bg-background/90 backdrop-blur-sm border-t border-border flex flex-col items-center gap-1"
      style={{ bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        onClick={onAction}
        className="w-full rounded-full bg-primary text-primary-foreground py-4 px-5 text-[15px] font-bold leading-none"
      >
        {t('action')}
      </button>
      <button
        type="button"
        onClick={onShare}
        className="text-[13px] font-bold text-muted-foreground py-1 px-2 hover:text-foreground"
      >
        {t('share')}
      </button>
    </div>
  );
}
