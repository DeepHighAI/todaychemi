'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
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

interface MemoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialBody?: string;
  onSubmit: (body: string) => void;
  submitting?: boolean;
}

export function MemoSheet({ open, onOpenChange, mode, initialBody = '', onSubmit, submitting = false }: MemoSheetProps) {
  const t = useTranslations('relations.detail.memos');
  const [body, setBody] = useState(initialBody);

  // edit 모드 재진입 시 initialBody 동기화
  useEffect(() => {
    if (open) setBody(initialBody);
  }, [open, initialBody]);

  const count = [...body].length;
  const isEmpty = body.trim().length === 0;

  function handleSubmit() {
    if (!isEmpty && !submitting) onSubmit(body.trim());
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent role="dialog" aria-labelledby="memo-sheet-title" aria-describedby="memo-sheet-desc">
        <DrawerHeader>
          <DrawerTitle id="memo-sheet-title">
            {mode === 'create' ? t('sheet.createTitle') : t('sheet.editTitle')}
          </DrawerTitle>
          <DrawerDescription id="memo-sheet-desc" className="sr-only">
            {t('sheet.description')}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2 space-y-2">
          <textarea
            data-testid="memo-sheet-input"
            className="w-full resize-none rounded-xl bg-[var(--surface-1)] p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={4}
            maxLength={80}
            placeholder={t('sheet.placeholder')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {/* 80자 카운터 — 클라이언트 계층 상한 */}
          <p
            data-testid="memo-sheet-counter"
            className={`text-xs text-right tabular-nums ${count >= 70 ? 'text-[var(--warn)]' : 'text-muted-foreground'}`}
          >
            {count}/80
          </p>
        </div>
        <DrawerFooter>
          <Button
            data-testid="memo-sheet-submit"
            className="w-full"
            disabled={isEmpty || submitting}
            onClick={handleSubmit}
          >
            {submitting ? t('sheet.submitting') : t('sheet.submit')}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              {t('sheet.cancel')}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
