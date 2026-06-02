'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
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
import { FeaturePaySheet } from '@/components/payments/feature-pay-sheet';
import { ERROR_COPY, type ErrorCode } from '@/lib/errors/error-codes';

interface Props {
  hapcardId: string;
  mode: string;
}

type State = 'idle' | 'loading' | 'success' | 'error';
type DisplayCode = Extract<ErrorCode, 'REPLAY_DURING_OUTAGE' | 'HAPCARD_NOT_FOUND' | 'INTERNAL_ERROR'>;

async function postReplay(hapcardId: string): Promise<unknown> {
  const res = await fetch(`/api/hapcards/${hapcardId}/replay`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code: string = body?.error?.code ?? 'INTERNAL_ERROR';
    // 402 PAYMENT_REQUIRED 는 결제 시트용 ref 를 함께 전달.
    throw Object.assign(new Error(code), { code, ref: body?.ref, amount_krw: body?.amount_krw });
  }
  return res.json();
}

export function HapcardReplayButton({ hapcardId, mode }: Props) {
  const t = useTranslations('hapcard');
  const qc = useQueryClient();
  const sp = useSearchParams();
  const replayParam = sp.get('replay');
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [errorCode, setErrorCode] = useState<DisplayCode | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payRef, setPayRef] = useState('');
  const [autoReplay, setAutoReplay] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFired = useRef(false);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const mutation = useMutation({
    mutationFn: () => postReplay(hapcardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hapcard', hapcardId] });
      setState('success');
      timerRef.current = setTimeout(() => setOpen(false), 1500);
    },
    onError: (err: unknown) => {
      const e = err as { code?: string; ref?: string };
      // 잔액 부족 → 결제 시트 (현금 결제 후 ?replay=1 로 복귀 재발화).
      if (e.code === 'PAYMENT_REQUIRED') {
        setPayRef(e.ref ?? '');
        setOpen(false);
        setState('idle');
        setPayOpen(true);
        return;
      }
      const raw = e.code;
      const code: DisplayCode =
        raw === 'REPLAY_DURING_OUTAGE' || raw === 'HAPCARD_NOT_FOUND'
          ? (raw as DisplayCode)
          : 'INTERNAL_ERROR';
      setErrorCode(code);
      setState('error');
    },
  });

  // 결제 후 복귀(?replay=1) → 다이얼로그 자동 재오픈 + 1회 재발화.
  // 재POST 는 잠금해제된 저장 row 를 반환(200) — 재과금/재빌드 없음.
  useEffect(() => {
    if (replayParam === '1' && !autoFired.current) {
      autoFired.current = true;
      setAutoReplay(true);
      setOpen(true);
      setState('loading');
      mutation.mutate();
    }
    // mutation 은 안정 — replayParam 변화에만 반응.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayParam]);

  function handleOpen(v: boolean) {
    if (!v) {
      setState('idle');
      setErrorCode(null);
      setAutoReplay(false);
    }
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

  function handlePaid() {
    setPayOpen(false);
    setOpen(true);
    setState('loading');
    mutation.mutate();
  }

  const isLoading = state === 'loading';

  return (
    <>
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
            <DialogDescription>
              {autoReplay ? t('replayButton.afterPayLoading') : t('replayButton.confirmBody')}
            </DialogDescription>
          </DialogHeader>

          {state === 'success' && (
            <p className="text-sm text-center text-primary py-2">
              {t('replayButton.successToast')}
            </p>
          )}

          {state === 'error' && (
            <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm space-y-2">
              <p>{ERROR_COPY[errorCode ?? 'INTERNAL_ERROR']}</p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                다시 시도
              </Button>
            </div>
          )}

          {state !== 'success' && !autoReplay && (
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

      <FeaturePaySheet
        feature="replay"
        featureRef={payRef}
        next={`/hapcard/${hapcardId}?mode=${mode}`}
        replay
        open={payOpen}
        onOpenChange={setPayOpen}
        onPaid={handlePaid}
      />
    </>
  );
}
