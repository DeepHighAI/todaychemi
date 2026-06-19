/**
 * reward-popup.tsx — 부적 지급 레이어 팝업 (항목 6/7)
 *
 * 가입(+50) / 매일 출석(+5) 보상 수령 시 획득 부적 수 + 사용 용도를 안내한다.
 * RewardGate 가 /api/rewards/session 응답으로 노출 여부를 결정한다.
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

        {/* 획득 부적 강조 배지 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderRadius: 'var(--r-lg)',
            backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
            padding: '20px 16px',
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--primary)',
          }}
        >
          <span aria-hidden style={{ fontSize: 24 }}>🪄</span>
          <span>{t('amount', { count: amount })}</span>
        </div>

        <DialogFooter>
          <Button variant="default" onClick={onClose} style={{ width: '100%' }}>
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
