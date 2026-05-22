'use client';

import { useState } from 'react';
import type { HapcardVisuals } from '@/types/hapcard';
import { buildSharePayload, type ShareRange } from '@/lib/share/build-share-payload';
import { shareOrCopy } from '@/lib/share/share-handler';
import { ShareSheet } from '@/components/hapcard/share-sheet';

export interface HapcardShareProps {
  hapcardId: string;
  mode: string;
  nickname?: string;
  score: number;
  genderNormalized?: 'F' | 'M';
  visuals: HapcardVisuals;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function HapcardShare({
  hapcardId,
  mode,
  nickname = '인연',
  score,
  genderNormalized = 'F',
  visuals,
  open: controlledOpen,
  onOpenChange,
}: HapcardShareProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined;
  const sheetOpen = isControlled ? controlledOpen : internalOpen;
  const setSheetOpen = isControlled ? onOpenChange : setInternalOpen;
  const [status, setStatus] = useState<'idle' | 'shared' | 'copied' | 'error'>('idle');

  const hapcardInput = {
    hapcard_id: hapcardId,
    mode,
    nickname,
    score,
    gender_normalized: genderNormalized,
    ohaeng_counts: visuals.relation.five_elements_counts as Record<string, number>,
    origin: typeof window !== 'undefined' ? window.location.origin : 'https://hap.plae',
  };

  async function handleShare(range: ShareRange) {
    const payload = buildSharePayload({ ...hapcardInput, range });
    try {
      const result = await shareOrCopy(payload);
      setStatus(result === 'shared' ? 'shared' : result === 'copied' ? 'copied' : 'idle');
      setSheetOpen(false);
    } catch {
      setStatus('error');
    }
  }

  return (
    <div data-testid="hapcard-share" className="px-4 pb-8 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold"
      >
        오늘 우리는 공유하기
      </button>
      {status === 'shared' && (
        <p className="text-xs text-muted-foreground">공유했어요!</p>
      )}
      {status === 'copied' && (
        <p className="text-xs text-muted-foreground">링크를 복사했어요!</p>
      )}
      {status === 'error' && (
        <p className="text-xs text-destructive">공유에 실패했어요.</p>
      )}
      <ShareSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        hapcard={hapcardInput}
        onShare={handleShare}
      />
    </div>
  );
}
