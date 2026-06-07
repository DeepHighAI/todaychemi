'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// 오늘케미 첫 진입 소개 팝업
// - 가입자(`/` 진입)와 게스트(`/guest/start` 진입) 양쪽에서 마운트되어 동일 카피 노출
// - 동일 키로 1회만 노출되므로 한쪽에서 본 후 다른 쪽 진입에서는 자동 스킵
// - localStorage 쓰기 실패(시크릿/사파리 ITP 등)에도 throw 하지 않음

const STORAGE_KEY = 'welcome_popup_seen_v1';

function readSeen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // 접근 실패 시 다시 노출되는 것보다 안전하게 차단
    return true;
  }
}

function markSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // 사파리 시크릿 모드 등 쓰기 실패 — 무시 (다음 세션에 한 번 더 보일 뿐)
  }
}

export function WelcomePopup() {
  const t = useTranslations('welcome.popup');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // mount-only localStorage 동기화 — SSR 에서는 readSeen=true 로 안전 디폴트,
    // client mount 후 1회만 실제 값으로 평가하여 hydration mismatch 회피.
    // 의존성 빈 배열 + 1회 호출이라 react-hooks/set-state-in-effect 가 잡는
    // 무한 re-render 위험에는 해당되지 않음.
    if (!readSeen()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only sync from localStorage; see comment above
      setOpen(true);
    }
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) {
      markSeen();
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[min(420px,calc(100vw-2rem))] gap-5 rounded-[var(--r-xl)] bg-card p-6"
      >
        <DialogHeader className="gap-3">
          <DialogTitle className="text-2xl font-extrabold leading-tight text-foreground">
            {t('title')}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-line text-[15px] leading-7 text-foreground/85">
            {t('body')}
          </DialogDescription>
        </DialogHeader>
        <p className="font-eyebrow text-primary">{t('cta')}</p>
        <Button
          type="button"
          onClick={() => handleOpenChange(false)}
          className="h-12 w-full rounded-[var(--r-pill)] font-bold"
        >
          {t('button')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
