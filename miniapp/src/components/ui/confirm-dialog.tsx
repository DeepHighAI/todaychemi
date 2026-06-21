/**
 * confirm-dialog.tsx — 공용 확인 다이얼로그 (Phase 6 드리프트 통합)
 *
 * 홈/피드/케미카드의 삭제 확인 오버레이가 각자 raw rgba 백드롭 + 매직넘버
 * borderRadius20 카드로 중복 구현돼 focus trap/Escape/portal a11y 가 없었다.
 * 동일한 "제목 + 본문 + 취소/확인" 구조를 ui/dialog(센터 모달, reward-popup 선례)
 * 위 하나로 통합한다. variant='destructive' 면 확인 버튼이 위험 색.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  /** 기본 '취소' */
  cancelLabel?: string;
  /** 확인 버튼 색. 기본 'default'(브랜드), 'destructive'(삭제 등 위험) */
  variant?: 'default' | 'destructive';
  /** 진행 중이면 확인 버튼 비활성 */
  isPending?: boolean;
  onConfirm: () => void;
  /** 취소/백드롭/Escape 닫기 공통 핸들러 */
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  variant = 'default',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            size="lg"
            style={{ flex: 1 }}
            disabled={isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
