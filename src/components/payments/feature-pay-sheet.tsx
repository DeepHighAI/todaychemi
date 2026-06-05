'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Drawer } from 'vaul';
import { loadTossPayments, type TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk';

import { Button } from '@/components/ui/button';
import type { FeatureId } from '@/lib/payments/feature-prices';
import type { FeaturePaymentInit, FeaturePaymentInitResponse } from '@/types/feature-payment';

// pay-per-use 결제 시트 (ADR-039, 모델 C). 402 PAYMENT_REQUIRED 수신 시 뷰가 연다.
// charge-client.tsx 의 Toss 위젯 마운트 패턴을 회수하되, 단일 피처/가격 + 전용 selector 사용.
interface FeaturePaySheetProps {
  feature: FeatureId;
  // 'ref' 는 React 예약 prop 이라 featureRef 로 받는다 (API body 키는 ref).
  featureRef: string;
  next: string;
  replay?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid?: () => void;
}

type Status = 'idle' | 'loading' | 'ready' | 'paying' | 'error';

// charge-client 와 다른 전용 ID — 동시 마운트 시 Toss 가 엉뚱한 노드를 잡지 않도록.
const METHODS_SELECTOR = '#feature-payment-methods';
const AGREEMENT_SELECTOR = '#feature-payment-agreement';

function clearWidgetContainers() {
  document.querySelector(METHODS_SELECTOR)?.replaceChildren();
  document.querySelector(AGREEMENT_SELECTOR)?.replaceChildren();
}

function getInitErrorMessage(errorCode?: string) {
  if (errorCode === 'PAYMENT_CONFIG_MISSING') {
    return '결제 설정이 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요.';
  }
  return '결제를 시작할 수 없어요. 잠시 후 다시 시도해주세요.';
}

export function FeaturePaySheet({
  feature,
  featureRef,
  next,
  replay = false,
  open,
  onOpenChange,
  onPaid,
}: FeaturePaySheetProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [payment, setPayment] = useState<FeaturePaymentInit | null>(null);
  const [errorMessage, setErrorMessage] = useState(getInitErrorMessage());
  const [retryNonce, setRetryNonce] = useState(0);
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);

  useEffect(() => {
    // 닫힌 동안엔 아무 것도 하지 않음(상태 리셋도 X — Drawer 닫힘 시 본문 비가시).
    // 재오픈 시 아래 async 가 즉시 loading 으로 리셋하므로 stale 노출 없음.
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setStatus('loading');
      setPayment(null);
      setErrorMessage(getInitErrorMessage());
      widgetsRef.current = null;
      clearWidgetContainers();
      try {
        const res = await fetch('/api/payments/feature/init', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ feature, ref: featureRef }),
        });
        if (!res.ok) {
          const errorBody = (await res.json().catch(() => null)) as
            | { error?: { code?: string } }
            | null;
          if (!cancelled) {
            setErrorMessage(getInitErrorMessage(errorBody?.error?.code));
            setStatus('error');
          }
          return;
        }
        const body = (await res.json()) as FeaturePaymentInitResponse;
        if (cancelled) return;
        if (body.unlocked) {
          // 이미 확정결제됨 — 위젯 불필요. 부모가 재요청해 캐시 본문을 노출한다.
          onPaid?.();
          onOpenChange(false);
          return;
        }
        const toss = await loadTossPayments(body.payment.client_key);
        const widgets = toss.widgets({ customerKey: body.payment.customer_key });
        await widgets.setAmount({ value: body.payment.amount_krw, currency: 'KRW' });
        await widgets.renderPaymentMethods({ selector: METHODS_SELECTOR, variantKey: 'DEFAULT' });
        await widgets.renderAgreement({ selector: AGREEMENT_SELECTOR, variantKey: 'AGREEMENT' });
        if (cancelled) return;
        widgetsRef.current = widgets;
        setPayment(body.payment);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      clearWidgetContainers();
    };
    // onPaid/onOpenChange 는 인라인 콜백일 수 있어 deps 에서 제외 — 포함 시 매 렌더 재-init 루프.
    // 취소 플래그로 stale 적용 방지. (charge-client 동일 패턴)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, feature, featureRef, retryNonce]);

  function retryInit() {
    setRetryNonce((value) => value + 1);
  }

  async function handlePay() {
    if (!widgetsRef.current || !payment) return;
    setStatus('paying');
    const origin = window.location.origin;
    const successUrl =
      `${origin}/api/payments/feature/confirm` +
      `?feature=${feature}` +
      `&ref=${encodeURIComponent(featureRef)}` +
      `&next=${encodeURIComponent(next)}` +
      (replay ? '&replay=1' : '');
    try {
      await widgetsRef.current.requestPayment({
        orderId: payment.order_id,
        orderName: payment.order_name,
        successUrl,
        failUrl: `${origin}/payments/fail`,
      });
    } catch {
      setStatus('ready');
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          data-testid="feature-pay-sheet"
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] bg-background"
        >
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[var(--surface-2)]" />
          <div className="relative overflow-hidden px-5 pb-5 pt-4">
            <div className="absolute inset-0 bg-liquid-hero opacity-90" />
            <div className="relative flex items-center justify-between text-white">
              <Drawer.Title className="text-lg font-extrabold">결제하고 결과 보기</Drawer.Title>
              <Drawer.Close asChild>
                <button
                  type="button"
                  aria-label="닫기"
                  className="flex size-9 items-center justify-center rounded-full bg-white/15"
                >
                  <X size={20} />
                </button>
              </Drawer.Close>
            </div>
            {payment && (
              <div className="relative mt-4 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.04em] text-white/80">
                  {payment.order_name}
                </p>
                <p className="mt-1 text-3xl font-extrabold leading-none">
                  ₩{payment.amount_krw.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3 overflow-y-auto px-5 pb-6 pt-5">
            {status !== 'error' && (
              <>
                <div
                  id="feature-payment-methods"
                  className="min-h-[200px] rounded-[var(--r-sm)] border border-[var(--hairline)] bg-background"
                />
                <div
                  id="feature-payment-agreement"
                  className="min-h-[80px] rounded-[var(--r-sm)] border border-[var(--hairline)] bg-background"
                />
              </>
            )}

            {status === 'error' && (
              <p
                role="alert"
                className="rounded-[var(--r-sm)] bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
              >
                {errorMessage}
              </p>
            )}

            <Button
              type="button"
              className="h-12 w-full"
              disabled={status === 'idle' || status === 'loading' || status === 'paying'}
              onClick={status === 'error' ? retryInit : handlePay}
            >
              {status === 'ready' && payment
                ? `₩${payment.amount_krw.toLocaleString()} 결제하기`
                : status === 'error'
                  ? '다시 시도'
                  : status === 'paying'
                    ? '결제창 여는 중…'
                    : '결제 준비 중…'}
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
