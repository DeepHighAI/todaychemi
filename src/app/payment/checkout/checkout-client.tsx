'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadTossPayments, type TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk';

import { Button } from '@/components/ui/button';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { LoadingState } from '@/components/feedback/LoadingState';
import type { PaymentOrderResponse } from '@/types/wallet';

async function fetchOrder(orderId: string): Promise<PaymentOrderResponse['order']> {
  const res = await fetch(`/api/payments/order?orderId=${encodeURIComponent(orderId)}`);
  if (!res.ok) {
    throw new Error('PAYMENT_ORDER_FETCH_FAILED');
  }
  const body = (await res.json()) as PaymentOrderResponse;
  return body.order;
}

export default function CheckoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<PaymentOrderResponse['order'] | null>(null);
  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!orderId) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);
        const nextOrder = await fetchOrder(orderId);
        if (nextOrder.status === 'confirmed') {
          router.replace('/me?payment=success');
          return;
        }

        const tossPayments = await loadTossPayments(nextOrder.client_key);
        const nextWidgets = tossPayments.widgets({ customerKey: nextOrder.customer_key });
        await nextWidgets.setAmount({ currency: 'KRW', value: nextOrder.amount_krw });
        await nextWidgets.renderPaymentMethods({ selector: '#payment-methods', variantKey: 'DEFAULT' });
        await nextWidgets.renderAgreement({ selector: '#payment-agreement', variantKey: 'AGREEMENT' });

        if (!cancelled) {
          setOrder(nextOrder);
          setWidgets(nextWidgets);
          setLoading(false);
        }
      } catch (err) {
        console.error('[payment/checkout]', err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    void setup();
    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  async function handleRequestPayment() {
    if (!widgets || !order) return;
    setRequesting(true);
    try {
      await widgets.requestPayment({
        orderId: order.toss_order_id,
        orderName: order.order_name,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (err) {
      console.error('[payment/request]', err);
      setRequesting(false);
      setError(true);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-6">
        <LoadingState />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-background px-4 py-6">
        <ErrorCard code="NETWORK_OFFLINE" onRetry={() => router.replace('/me')} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <section className="mx-auto max-w-md space-y-4">
        <header className="space-y-2">
          <p className="text-sm font-semibold text-primary">부적 충전</p>
          <h1 className="text-2xl font-extrabold text-foreground">{order.order_name}</h1>
          <p className="text-sm text-muted-foreground">
            결제 금액 {order.amount_krw.toLocaleString()}원 · 충전 부적 {order.token_amount}개
          </p>
        </header>

        <div
          id="payment-methods"
          className="min-h-[220px] rounded-[var(--r-md)] border border-border bg-card p-2"
        />
        <div
          id="payment-agreement"
          className="min-h-[96px] rounded-[var(--r-md)] border border-border bg-card p-2"
        />

        <Button
          type="button"
          className="h-12 w-full"
          disabled={requesting || !widgets}
          onClick={handleRequestPayment}
        >
          {requesting ? '결제창 여는 중…' : `${order.amount_krw.toLocaleString()}원 결제하기`}
        </Button>
      </section>
    </main>
  );
}
