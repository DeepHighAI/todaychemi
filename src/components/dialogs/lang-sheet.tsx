'use client';

import { Drawer } from 'vaul';
import { Check, X } from 'lucide-react';

interface LangSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LANGS = [
  ['ko', '한국어', '현재 지원'],
  ['en', 'English', '준비 중'],
  ['vi', 'Tiếng Việt', '준비 중'],
] as const;

export function LangSheet({ open, onOpenChange }: LangSheetProps) {
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
            <Drawer.Title className="flex-1 text-base font-extrabold">언어 변경</Drawer.Title>
            <Drawer.Close asChild>
              <button type="button" aria-label="닫기" className="flex size-9 items-center justify-center rounded-full bg-[var(--surface-2)]">
                <X size={18} />
              </button>
            </Drawer.Close>
          </div>
          <div className="px-4 py-4">
            {LANGS.map(([code, label, status]) => {
              const active = code === 'ko';
              return (
                <button
                  key={code}
                  type="button"
                  disabled={!active}
                  className={`flex w-full items-center gap-3 rounded-[var(--r-md)] px-4 py-3 text-left ${
                    active ? 'bg-primary/10 text-foreground' : 'text-muted-foreground opacity-60'
                  }`}
                >
                  <span className="flex-1">
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="mt-0.5 block text-xs">{status}</span>
                  </span>
                  {active && <Check size={18} className="text-primary" />}
                </button>
              );
            })}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
