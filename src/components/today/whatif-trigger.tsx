'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { WhatifSheet } from '@/components/whatif/whatif-sheet';

export function WhatifTrigger() {
  const t = useTranslations('whatif');
  const [open, setOpen] = useState(false);

  return (
    <div className="px-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full bg-primary text-primary-foreground rounded-[var(--r-lg)] p-4 flex items-center gap-3"
      >
        <Sparkles size={20} />
        <span>{t('sheet.trigger')}</span>
      </button>
      <WhatifSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}
