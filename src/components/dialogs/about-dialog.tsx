'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMPANY_ROWS = [
  ['회사명', '(주) 딥하이'],
  ['대표이사', '심충섭'],
  ['주소', '서울특별시 효령로 428 광림빌딩 3층 딥하이'],
  ['사업자 등록번호', '798-86-01094'],
  ['대표번호', '02 3443 1028'],
] as const;

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-[340px] rounded-[var(--r-xl)] p-5">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">오늘사이</DialogTitle>
          <DialogDescription className="text-sm leading-6">
            TWODAY. 우리 오늘 무슨 사이야? 오늘 만나는 사람과의 흐름을 미리 확인하는 관계 사주 서비스입니다.
          </DialogDescription>
        </DialogHeader>
        <dl className="mt-4 space-y-2 border-t border-[var(--hairline)] pt-4">
          {COMPANY_ROWS.map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-24 shrink-0 text-xs font-semibold text-muted-foreground">{label}</dt>
              <dd className="flex-1 text-right text-xs font-medium leading-5 text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
