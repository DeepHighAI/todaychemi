'use client';

import { Drawer } from 'vaul';
import { X } from 'lucide-react';

interface LegalSheetProps {
  variant: 'privacy' | 'terms';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LegalSheet({ variant, open, onOpenChange }: LegalSheetProps) {
  const isPrivacy = variant === 'privacy';
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-[var(--r-xl)] bg-background"
        >
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[var(--surface-2)]" />
          <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4 py-3">
            <Drawer.Title className="flex-1 text-base font-extrabold">
              {isPrivacy ? '개인정보처리방침' : '이용약관'}
            </Drawer.Title>
            <Drawer.Close asChild>
              <button type="button" aria-label="닫기" className="flex size-9 items-center justify-center rounded-full bg-[var(--surface-2)]">
                <X size={18} />
              </button>
            </Drawer.Close>
          </div>
          <div className="px-5 py-6">
            <p className="rounded-[var(--r-md)] bg-card p-4 text-sm leading-6 text-muted-foreground">
              정식 법적 문서는 배포 전 최종 검토 후 공개됩니다. 현재 화면은 메뉴 진입 위치와 정보 구조만 확인하기 위한 준비 상태입니다.
            </p>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
