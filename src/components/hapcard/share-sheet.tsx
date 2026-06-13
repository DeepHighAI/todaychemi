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
import type { ShareLayout } from '@/lib/og/render-payload';
import type { SharePayloadInput } from '@/lib/share/build-share-payload';

export type ShareSheetAction = 'kakao' | 'instagram' | 'copy_link';

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hapcard: SharePayloadInput;
  onShare: (layout: ShareLayout, showGender: boolean, action: ShareSheetAction) => void;
  busyAction?: ShareSheetAction | null;
}

const LAYOUT_OPTIONS: Array<{ value: ShareLayout; labelKey: string }> = [
  { value: 'minimal', labelKey: 'minimal' },
  { value: 'ohaeng', labelKey: 'ohaeng' },
  { value: 'radar', labelKey: 'radar' },
  { value: 'comment', labelKey: 'comment' },
  { value: 'flow', labelKey: 'flow' },
];

export function ShareSheet({ open, onOpenChange, hapcard, onShare, busyAction = null }: ShareSheetProps) {
  const t = useTranslations('hapcard.shareSheet');
  const [layout, setLayout] = useState<ShareLayout>('minimal');
  const [showGender, setShowGender] = useState(false);

  // 프리뷰 = 실제 인증 OG 이미지 (선택 레이아웃·성별). "보이는 그대로 공유" (§1.1).
  const previewSrc = `/api/og/hapcard/${encodeURIComponent(hapcard.hapcard_id)}?layout=${layout}&gender=${showGender ? 1 : 0}`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent role="dialog" aria-labelledby="share-sheet-title" aria-describedby="share-sheet-desc">
        <DrawerHeader>
          <DrawerTitle id="share-sheet-title">{t('title')}</DrawerTitle>
          <DrawerDescription id="share-sheet-desc" className="sr-only">
            {t('description')}
          </DrawerDescription>
        </DrawerHeader>

        {/* 실제 OG 미리보기 */}
        <div className="px-4 pb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={previewSrc}
            src={previewSrc}
            alt={t('preview')}
            aria-label="공유 미리보기"
            width={1200}
            height={630}
            className="aspect-[1200/630] w-full rounded-[var(--radius-xl)] border border-border bg-card object-cover shadow-md"
          />
        </div>

        {/* 레이아웃 탭 5종 */}
        <div
          role="group"
          aria-label={t('layoutGroupLabel')}
          className="px-4 pb-2 flex flex-wrap gap-2"
        >
          {LAYOUT_OPTIONS.map(({ value, labelKey }) => (
            <button
              key={value}
              type="button"
              aria-pressed={layout === value}
              onClick={() => setLayout(value)}
              className={`min-h-[40px] rounded-[var(--radius-pill)] px-3.5 text-sm font-semibold ${
                layout === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {t(`layout.${labelKey}`)}
            </button>
          ))}
        </div>

        {/* 성별 표시 토글 (ADR-024 옵트인) */}
        <div className="px-4 pb-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={showGender}
              onChange={(e) => setShowGender(e.target.checked)}
              className="accent-primary"
            />
            <span>{t('showGender')}</span>
          </label>
        </div>

        <DrawerFooter>
          <Button
            className="w-full gap-2 border-[var(--kakao-yellow)] bg-[var(--kakao-yellow)] text-[var(--kakao-foreground)] hover:bg-[var(--kakao-yellow-hover)]"
            onClick={() => onShare(layout, showGender, 'kakao')}
            disabled={busyAction !== null}
          >
            <MessageCircle size={18} />
            {busyAction === 'kakao' ? t('sending') : t('ctaKakao')}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => onShare(layout, showGender, 'instagram')}
            disabled={busyAction !== null}
          >
            <ImageDown size={18} />
            {busyAction === 'instagram' ? t('sending') : t('ctaInstagram')}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => onShare(layout, showGender, 'copy_link')}
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
