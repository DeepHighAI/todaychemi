'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ERROR_COPY, ERROR_CTA } from '@/lib/errors/error-codes';
import type { ReplayErrorCode } from '@/types/hapcard';

type HapcardMode = '일합' | '친구합' | '돈합' | '첫합' | '썸합' | '오래합';

interface Props {
  hapcardId: string;
  mode: HapcardMode;
}

type State = 'idle' | 'loading' | 'success' | 'error';

async function postReplay(hapcardId: string): Promise<unknown> {
  const res = await fetch(`/api/hapcards/${hapcardId}/replay`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code: ReplayErrorCode = body?.error?.code ?? 'INTERNAL_ERROR';
    throw Object.assign(new Error(code), { code });
  }
  return res.json();
}

export function HapcardReplayButton({ hapcardId, mode: _mode }: Props) {
  const t = useTranslations('hapcard');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [errorCode, setErrorCode] = useState<ReplayErrorCode | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const mutation = useMutation({
    mutationFn: () => postReplay(hapcardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hapcard', hapcardId] });
      setState('success');
      timerRef.current = setTimeout(() => setOpen(false), 1500);
    },
    onError: (err: unknown) => {
      const code = (err as { code?: ReplayErrorCode })?.code ?? 'INTERNAL_ERROR';
      setErrorCode(code as ReplayErrorCode);
      setState('error');
    },
  });

  function handleOpen(v: boolean) {
    if (!v) { setState('idle'); setErrorCode(null); }
    setOpen(v);
  }

  function handleConfirm() {
    setState('loading');
    mutation.mutate();
  }

  function handleRetry() {
    setState('idle');
    setErrorCode(null);
  }

  const isLoading = state === 'loading';

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <button
        role="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        {t('replayButton.label')}
      </button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('replayButton.confirmTitle')}</DialogTitle>
          <DialogDescription>{t('replayButton.confirmBody')}</DialogDescription>
        </DialogHeader>

        {state === 'success' && (
          <p className="text-sm text-center text-primary py-2">
            {t('replayButton.successToast')}
          </p>
        )}

        {state === 'error' && errorCode === 'INSUFFICIENT_TOKENS' && (
          <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm space-y-2">
            <p>{t('replayButton.insufficientTokens')}</p>
            {ERROR_CTA['INSUFFICIENT_TOKENS'] && (
              <a
                href={ERROR_CTA['INSUFFICIENT_TOKENS'].href}
                className="text-primary underline"
              >
                {ERROR_CTA['INSUFFICIENT_TOKENS'].label}
              </a>
            )}
          </div>
        )}

        {state === 'error' && errorCode !== 'INSUFFICIENT_TOKENS' && (
          <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm space-y-2">
            <p>{ERROR_COPY[errorCode ?? 'INTERNAL_ERROR']}</p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              다시 시도
            </Button>
          </div>
        )}

        {state !== 'success' && (
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => handleOpen(false)}
              disabled={isLoading}
            >
              {t('replayButton.cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading || state === 'error'}
            >
              {isLoading ? '처리 중…' : t('replayButton.confirmCta')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
