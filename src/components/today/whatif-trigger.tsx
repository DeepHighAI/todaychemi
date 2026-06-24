'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, ChevronRight } from 'lucide-react';
import { WhatifSheet } from '@/components/whatif/whatif-sheet';
import {
  markPaidFeatureClickedToday,
  shouldShowPaidFeatureAttention,
} from '@/lib/paid-feature-attention';

export function WhatifTrigger() {
  const t = useTranslations('whatif');
  const [open, setOpen] = useState(false);
  const [showDot, setShowDot] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowDot(shouldShowPaidFeatureAttention('whatif'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function handleClick() {
    markPaidFeatureClickedToday('whatif');
    setShowDot(false);
    setOpen(true);
  }

  return (
    <section className="px-4">
      <button
        type="button"
        aria-label={t('sheet.trigger')}
        onClick={handleClick}
        className="relative w-full overflow-hidden rounded-[var(--r-xl)] border border-primary/20 bg-card p-4 text-left shadow-[var(--e-1)] active:scale-[0.99] transition"
      >
        <span
          aria-hidden
          className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-primary/20 to-transparent"
        />
        {showDot && (
          <span
            aria-hidden="true"
            className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.18)]"
          />
        )}
        <span className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-foreground">
            <Sparkles size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-primary">
              {t('sheet.eyebrow')}
            </span>
            <span className="mt-0.5 block text-[17px] font-extrabold leading-tight text-foreground">
              {t('sheet.trigger')}
            </span>
            <span className="mt-1 block text-[13px] font-semibold leading-5 text-muted-foreground">
              {t('sheet.spotlight')}
            </span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-primary" />
        </span>
      </button>
      <WhatifSheet open={open} onOpenChange={setOpen} />
    </section>
  );
}
