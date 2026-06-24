'use client';

/**
 * reward-popup.tsx — 부적 지급 레이어 팝업 (항목 6/7, 웹)
 *
 * 가입(+100) / 매일 출석(+10) 부적 수령 시 획득 부적 수 + 사용 용도를 안내한다.
 * FreeTalismanRewardGate 가 /api/rewards/session 응답으로 노출 여부를 결정한다.
 * 미니앱 포트: miniapp/src/components/rewards/reward-popup.tsx
 */

import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface RewardPopupProps {
  open: boolean;
  /** 이번에 획득한 부적 총 개수 */
  amount: number;
  /** 가입 보상 포함 여부 (true=환영 카피, false=출석 카피) */
  isSignup: boolean;
  onClose: () => void;
}

export function RewardPopup({ open, amount, isSignup, onClose }: RewardPopupProps) {
  const t = useTranslations('rewards.popup');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{isSignup ? t('title.signup') : t('title.daily')}</DialogTitle>
          <DialogDescription>{t('usage')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 rounded-2xl bg-primary/10 px-4 py-5 text-[22px] font-extrabold text-primary">
          <span aria-hidden className="text-2xl">🪄</span>
          <span>{t('amount', { count: amount })}</span>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
