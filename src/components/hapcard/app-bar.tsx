'use client';

import { ChevronLeft, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface HapcardAppBarProps {
  onShare?: () => void;
  onBack?: () => void;
}

export function HapcardAppBar({ onShare, onBack }: HapcardAppBarProps) {
  const router = useRouter();
  const t = useTranslations('hapcard.appBar');

  return (
    <header
      data-testid="hapcard-app-bar"
      className="sticky top-0 z-40 h-12 flex items-center justify-between px-2 bg-background/80 backdrop-blur-sm border-b border-border"
    >
      <button
        type="button"
        aria-label={t('back')}
        onClick={() => (onBack ? onBack() : router.back())}
        className="inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-muted text-foreground"
      >
        <ChevronLeft size={22} />
      </button>
      <h1 className="text-base font-semibold text-foreground">{t('title')}</h1>
      <button
        type="button"
        aria-label={t('share')}
        onClick={onShare}
        className="inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-muted text-foreground"
      >
        <Share2 size={20} />
      </button>
    </header>
  );
}
