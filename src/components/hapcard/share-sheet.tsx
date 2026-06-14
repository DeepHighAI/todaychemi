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
import { SHARE_OG_HEIGHT, SHARE_OG_WIDTH } from '@/lib/og/dimensions';
import { serializeShareOhaengCounts, type ShareLayout } from '@/lib/og/render-payload';
import type { SharePayloadInput } from '@/lib/share/build-share-payload';

export type ShareSheetAction = 'kakao' | 'instagram' | 'copy_link';

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hapcard: SharePayloadInput;
  onShare: (layout: ShareLayout, showGender: boolean, action: ShareSheetAction) => void;
  busyAction?: ShareSheetAction | null;
}

const SHARE_CARD_LAYOUT: ShareLayout = 'combined';
const SHARE_CARD_VERSION = '5';

function buildPreviewSrc(hapcard: SharePayloadInput, showGender: boolean): string {
  const params = new URLSearchParams({
    layout: SHARE_CARD_LAYOUT,
    gender: showGender ? '1' : '0',
    v: SHARE_CARD_VERSION,
  });
  const ohaeng = serializeShareOhaengCounts(hapcard.ohaeng_counts);
  if (ohaeng) params.set('ohaeng', ohaeng);
  return `/api/og/hapcard/${encodeURIComponent(hapcard.hapcard_id)}?${params.toString()}`;
}

export function ShareSheet({ open, onOpenChange, hapcard, onShare, busyAction = null }: ShareSheetProps) {
  const t = useTranslations('hapcard.shareSheet');
  const [showGender, setShowGender] = useState(false);

  // 프리뷰 = 실제 인증 OG 이미지 (통합 카드·성별). "보이는 그대로 공유" (§1.1).
  const previewSrc = buildPreviewSrc(hapcard, showGender);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
          <DrawerDescription className="sr-only">
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
            width={SHARE_OG_WIDTH}
            height={SHARE_OG_HEIGHT}
            className="mx-auto max-h-[56vh] w-auto max-w-full rounded-[var(--radius-xl)] border border-border bg-card object-contain shadow-md"
          />
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
            onClick={() => onShare(SHARE_CARD_LAYOUT, showGender, 'kakao')}
            disabled={busyAction !== null}
          >
            <MessageCircle size={18} />
            {busyAction === 'kakao' ? t('sending') : t('ctaKakao')}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => onShare(SHARE_CARD_LAYOUT, showGender, 'instagram')}
            disabled={busyAction !== null}
          >
            <ImageDown size={18} />
            {busyAction === 'instagram' ? t('sending') : t('ctaInstagram')}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => onShare(SHARE_CARD_LAYOUT, showGender, 'copy_link')}
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
