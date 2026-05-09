'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { DIAGNOSTIC_TYPE, type DiagnosticType } from '@/types/diagnostic';

interface WhatifSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatifSheet({ open, onOpenChange }: WhatifSheetProps) {
  const t = useTranslations('whatif');
  const router = useRouter();

  const handleSelect = (type: DiagnosticType) => {
    onOpenChange(false);
    router.push(`/whatif/${type}`);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent role="dialog" aria-labelledby="whatif-sheet-title">
        <DrawerHeader>
          <DrawerTitle id="whatif-sheet-title">{t('sheet.title')}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4 space-y-2">
          {Object.values(DIAGNOSTIC_TYPE).map((type) => (
            <button
              key={type}
              type="button"
              data-testid={`whatif-row-${type}`}
              onClick={() => handleSelect(type)}
              className="w-full flex items-center justify-between rounded-2xl bg-card p-4 text-foreground text-sm font-medium"
            >
              {t(`card.${type}.title`)}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
