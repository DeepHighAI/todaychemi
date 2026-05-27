'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, ImageDown, MessageCircle } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { HapcardSharePreviewTile } from '@/components/hapcard/share-preview-tile';
import type { SharePayloadInput, ShareRange } from '@/lib/share/build-share-payload';

export type ShareSheetAction = 'kakao' | 'instagram' | 'copy_link';

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hapcard: SharePayloadInput;
  onShare: (range: ShareRange, action: ShareSheetAction) => void;
  busyAction?: ShareSheetAction | null;
}

const RANGE_OPTIONS: Array<{ value: ShareRange; labelKey: string }> = [
  { value: 'nickname-only', labelKey: 'nicknameOnly' },
  { value: 'nickname-ohaeng', labelKey: 'withOhaeng' },
  { value: 'nickname-gender', labelKey: 'withGender' },
];

export function ShareSheet({ open, onOpenChange, hapcard, onShare, busyAction = null }: ShareSheetProps) {
  const t = useTranslations('hapcard.shareSheet');
  const [range, setRange] = useState<ShareRange>('nickname-only');

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent role="dialog" aria-labelledby="share-sheet-title" aria-describedby="share-sheet-desc">
        <DrawerHeader>
          <DrawerTitle id="share-sheet-title">{t('title')}</DrawerTitle>
          <DrawerDescription id="share-sheet-desc" className="sr-only">
            {t('description')}
          </DrawerDescription>
        </DrawerHeader>
        <HapcardSharePreviewTile hapcard={hapcard} range={range} />
        <div className="px-4 pb-2 space-y-2">
          {RANGE_OPTIONS.map(({ value, labelKey }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="share-range"
                value={value}
                checked={range === value}
                onChange={() => setRange(value)}
                className="accent-primary"
              />
              <span className="text-sm">{t(`range.${labelKey}`)}</span>
            </label>
          ))}
        </div>
        <DrawerFooter>
          <Button
            className="w-full gap-2 border-[var(--kakao-yellow)] bg-[var(--kakao-yellow)] text-[var(--kakao-foreground)] hover:bg-[var(--kakao-yellow-hover)]"
            onClick={() => onShare(range, 'kakao')}
            disabled={busyAction !== null}
          >
            <MessageCircle size={18} />
            {busyAction === 'kakao' ? t('sending') : t('ctaKakao')}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => onShare(range, 'instagram')}
            disabled={busyAction !== null}
          >
            <ImageDown size={18} />
            {busyAction === 'instagram' ? t('sending') : t('ctaInstagram')}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => onShare(range, 'copy_link')}
            disabled={busyAction !== null}
          >
            <Copy size={18} />
            {busyAction === 'copy_link' ? t('sending') : t('ctaCopy')}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
