'use client';

import { useState } from 'react';
import type { HapcardVisuals } from '@/types/hapcard';
import type { ShareRange } from '@/lib/share/build-share-payload';
import { shareToKakao } from '@/lib/share/kakao-sdk';
import { copyShareLink, shareCardOrDownload } from '@/lib/share/share-handler';
import { ShareSheet, type ShareSheetAction } from '@/components/hapcard/share-sheet';

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

interface ShareCreateResponse {
  ok: true;
  share_id: string;
  url: string;
  og_image_url: string;
  title: string;
  text: string;
  expires_at: string;
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
  const [status, setStatus] = useState<'idle' | 'kakao' | 'shared' | 'copied' | 'downloaded' | 'error'>('idle');
  const [busyAction, setBusyAction] = useState<ShareSheetAction | null>(null);

  const hapcardInput = {
    hapcard_id: hapcardId,
    mode,
    nickname,
    score,
    gender_normalized: genderNormalized,
    ohaeng_counts: visuals.relation.five_elements_counts as Record<string, number>,
    origin: typeof window !== 'undefined' ? window.location.origin : 'https://hap.plae',
  };

  async function handleShare(range: ShareRange, action: ShareSheetAction) {
    setBusyAction(action);
    setStatus('idle');
    try {
      const created = await createShare(hapcardId, range, action);
      const payload = {
        title: created.title,
        text: created.text,
        url: created.url,
        og_image_url: created.og_image_url,
      };

      if (action === 'kakao') {
        await shareToKakao({ ...payload, share_id: created.share_id });
        setStatus('kakao');
        setSheetOpen(false);
        return;
      }

      if (action === 'instagram') {
        const result = await shareCardOrDownload(payload);
        if (result === 'aborted') {
          setStatus('idle');
          return;
        }
        if (result === 'shared') {
          setStatus('shared');
        } else {
          setStatus('downloaded');
        }
        setSheetOpen(false);
        return;
      }

      await copyShareLink(payload);
      setStatus('copied');
      setSheetOpen(false);
    } catch {
      setStatus('error');
    } finally {
      setBusyAction(null);
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
      {status === 'kakao' && (
        <p className="text-xs text-muted-foreground">카카오톡 공유창을 열었어요.</p>
      )}
      {status === 'copied' && (
        <p className="text-xs text-muted-foreground">링크를 복사했어요!</p>
      )}
      {status === 'downloaded' && (
        <p className="text-xs text-muted-foreground">카드 이미지를 저장했어요.</p>
      )}
      {status === 'error' && (
        <p className="text-xs text-destructive">공유에 실패했어요.</p>
      )}
      <ShareSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        hapcard={hapcardInput}
        onShare={handleShare}
        busyAction={busyAction}
      />
    </div>
  );
}

async function createShare(
  hapcardId: string,
  range: ShareRange,
  action: ShareSheetAction,
): Promise<ShareCreateResponse> {
  const res = await fetch(`/api/hapcards/${encodeURIComponent(hapcardId)}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, channel: action }),
  });
  if (!res.ok) throw new Error('SHARE_CREATE_FAILED');
  return res.json() as Promise<ShareCreateResponse>;
}
