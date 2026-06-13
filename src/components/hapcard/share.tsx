'use client';

import { useState } from 'react';
import type { HapcardVisuals } from '@/types/hapcard';
import { trackEvent } from '@/lib/analytics/ga';
import type { ShareRange } from '@/lib/share/build-share-payload';
import { layoutToShareRange, type ShareLayout } from '@/lib/og/render-payload';
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

  async function handleShare(layout: ShareLayout, showGender: boolean, action: ShareSheetAction) {
    setBusyAction(action);
    setStatus('idle');
    try {
      // 공개 토큰 OG(수신자 미리보기)는 아직 range 기반 — 가장 가까운 range 로 매핑(Phase 2 레이아웃 운반).
      const range = layoutToShareRange(layout, showGender);
      const created = await createShare(hapcardId, range, action);
      const payload = {
        title: created.title,
        text: created.text,
        url: created.url,
        og_image_url: created.og_image_url,
      };
      // 저장/인스타는 사용자가 이미지 자체를 게시 → 선택 레이아웃의 인증 OG 이미지 사용(보이는 그대로).
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const authedImageUrl = `${origin}/api/og/hapcard/${encodeURIComponent(hapcardId)}?layout=${layout}&gender=${showGender ? 1 : 0}`;

      if (action === 'kakao') {
        await shareToKakao({ ...payload, share_id: created.share_id });
        trackEvent({ name: 'share', params: { method: 'kakao', content_type: 'hapcard' } });
        setStatus('kakao');
        setSheetOpen(false);
        return;
      }

      if (action === 'instagram') {
        const result = await shareCardOrDownload({ ...payload, og_image_url: authedImageUrl });
        if (result === 'aborted') {
          setStatus('idle');
          return;
        }
        trackEvent({ name: 'share', params: { method: 'instagram', content_type: 'hapcard' } });
        if (result === 'shared') {
          setStatus('shared');
        } else {
          setStatus('downloaded');
        }
        setSheetOpen(false);
        return;
      }

      await copyShareLink(payload);
      trackEvent({ name: 'share', params: { method: 'link', content_type: 'hapcard' } });
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
        오늘 케미 공유하기
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
