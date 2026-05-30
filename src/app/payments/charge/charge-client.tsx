'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, CreditCard, ShieldCheck, Sparkles } from 'lucide-react';
import { loadTossPayments, type TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk';

import { Button } from '@/components/ui/button';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { LoadingState } from '@/components/feedback/LoadingState';
import { listTossProducts, type TossProductId } from '@/lib/payments/products';
import type { PaymentInitResponse, PaymentOrderResponse, WalletProduct } from '@/types/wallet';

type PaymentOrder = PaymentOrderResponse['order'];
type WidgetState = 'idle' | 'creating' | 'mounting' | 'ready' | 'requesting';
type ChargeErrorKind = 'auth' | 'network' | 'already_confirmed' | 'not_payable';

const PRODUCTS: WalletProduct[] = listTossProducts();
const DEFAULT_PRODUCT_ID: TossProductId = 'tokens_50';

interface ChargeClientProps {
  authenticated?: boolean;
}

class PaymentChargeError extends Error {
  constructor(public readonly kind: ChargeErrorKind) {
    super(kind);
    this.name = 'PaymentChargeError';
  }
}

async function initPayment(productId: TossProductId): Promise<PaymentInitResponse['payment']> {
  const res = await fetch('/api/payments/init', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ product_id: productId }),
  });
  if (res.status === 401) {
    throw new PaymentChargeError('auth');
  }
  if (!res.ok) {
    throw new PaymentChargeError('network');
  }
  const body = (await res.json()) as PaymentInitResponse;
  return body.payment;
}

async function fetchOrder(orderId: string): Promise<PaymentOrder> {
  const res = await fetch(`/api/payments/order?orderId=${encodeURIComponent(orderId)}`);
  if (res.status === 401) {
    throw new PaymentChargeError('auth');
  }
  if (!res.ok) {
    const errorCode = await readApiErrorCode(res);
    if (errorCode === 'PAYMENT_ALREADY_CONFIRMED') {
      throw new PaymentChargeError('already_confirmed');
    }
    if (errorCode === 'PAYMENT_NOT_PAYABLE') {
      throw new PaymentChargeError('not_payable');
    }
    throw new PaymentChargeError('network');
  }
  const body = (await res.json()) as PaymentOrderResponse;
  return body.order;
}

export default function ChargeClient({ authenticated = true }: ChargeClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [selectedId, setSelectedId] = useState<TossProductId>(DEFAULT_PRODUCT_ID);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [widgetState, setWidgetState] = useState<WidgetState>(orderId ? 'mounting' : 'idle');
  const [errorKind, setErrorKind] = useState<ChargeErrorKind | null>(null);
  const displayedErrorKind: ChargeErrorKind | null = authenticated ? errorKind : 'auth';

  useEffect(() => {
    if (!orderId) return undefined;
    if (!authenticated) {
      return undefined;
    }

    let cancelled = false;

    async function setupExistingOrder() {
      try {
        setWidgetState('mounting');
        setErrorKind(null);
        const nextOrder = await fetchOrder(orderId as string);
        if (nextOrder.status === 'confirmed') {
          router.replace(`/payments/success?orderId=${encodeURIComponent(nextOrder.toss_order_id)}`);
          return;
        }
        setSelectedId(nextOrder.product_id);
        await mountPaymentWidget(nextOrder, () => cancelled);
      } catch (err) {
        if (!cancelled) {
          const kind = getChargeErrorKind(err);
          if (kind === 'already_confirmed') {
            router.replace(`/payments/success?orderId=${encodeURIComponent(orderId as string)}`);
            return;
          }
          setWidgetState('idle');
          setErrorKind(kind);
        }
      }
    }

    void setupExistingOrder();
    return () => {
      cancelled = true;
    };
  }, [authenticated, orderId, router]);

  async function mountPaymentWidget(nextOrder: PaymentOrder, isCancelled: () => boolean) {
    clearPaymentWidgetContainers();
    const tossPayments = await loadTossPayments(nextOrder.client_key);
    const nextWidgets = tossPayments.widgets({ customerKey: nextOrder.customer_key });
    await nextWidgets.setAmount({ value: nextOrder.amount_krw, currency: 'KRW' });
    await nextWidgets.renderPaymentMethods({ selector: '#payment-methods', variantKey: 'DEFAULT' });
    await nextWidgets.renderAgreement({ selector: '#payment-agreement', variantKey: 'AGREEMENT' });

    if (!isCancelled()) {
      setOrder(nextOrder);
      setWidgets(nextWidgets);
      setWidgetState('ready');
    }
  }

  async function handlePreparePayment() {
    if (!authenticated) {
      setErrorKind('auth');
      return;
    }
    try {
      setWidgetState('creating');
      setErrorKind(null);
      setOrder(null);
      setWidgets(null);
      clearPaymentWidgetContainers();
      const payment = await initPayment(selectedId);
      const nextOrder = await fetchOrder(payment.toss_order_id);
      setWidgetState('mounting');
      await mountPaymentWidget(nextOrder, () => false);
    } catch (err) {
      setWidgetState('idle');
      setErrorKind(getChargeErrorKind(err));
    }
  }

  async function handleRequestPayment() {
    if (!widgets || !order) return;
    setWidgetState('requesting');
    try {
      await widgets.requestPayment({
        orderId: order.toss_order_id,
        orderName: order.order_name,
        successUrl: `${window.location.origin}/api/payments/confirm`,
        failUrl: `${window.location.origin}/payments/fail`,
      });
    } catch {
      setWidgetState('ready');
      setErrorKind('network');
    }
  }

  function handleSelectProduct(productId: TossProductId) {
    if (widgetState === 'requesting') return;
    setSelectedId(productId);
    setOrder(null);
    setWidgets(null);
    setWidgetState('idle');
    setErrorKind(null);
    clearPaymentWidgetContainers();
  }

  const selectedProduct = PRODUCTS.find((product) => product.product_id === selectedId) ?? PRODUCTS[0];
  const preparing = widgetState === 'creating' || widgetState === 'mounting';
  const hasMountedWidget = Boolean(widgets && order);

  if (orderId && widgetState === 'mounting' && !order && !displayedErrorKind) {
    return (
      <main className="min-h-screen bg-background px-4 py-6">
        <LoadingState />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <section className="mx-auto flex max-w-md flex-col gap-4">
        <header className="overflow-hidden rounded-[var(--r-md)] border border-[var(--hairline)] bg-[linear-gradient(135deg,#fff7e8_0%,#eef8ff_48%,#f2e7ff_100%)] p-4 shadow-[var(--e-1)]">
          <div className="flex items-center gap-3">
            <span className="flex size-14 items-center justify-center rounded-[18px] bg-[var(--p-40)] text-white shadow-[var(--e-2)]">
              <Sparkles size={27} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.04em] text-[var(--p-40)]">부적 충전</p>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight text-foreground">필요한 만큼 바로 채워요</h1>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            토스페이먼츠 보안 결제로 충전하고, 결제 완료 후 부적이 지갑에 반영됩니다.
          </p>
        </header>

        <section className="space-y-3">
          {PRODUCTS.map((product) => (
            <button
              key={product.product_id}
              type="button"
              aria-pressed={selectedId === product.product_id}
              disabled={widgetState === 'requesting'}
              onClick={() => handleSelectProduct(product.product_id)}
              className={`flex w-full items-center gap-3 rounded-[var(--r-md)] border p-4 text-left shadow-[var(--e-1)] transition ${
                selectedId === product.product_id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card'
              }`}
            >
              <span className="flex size-11 items-center justify-center rounded-[14px] bg-[var(--surface-2)] text-primary">
                {selectedId === product.product_id ? <Check size={22} /> : <Sparkles size={22} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-extrabold text-foreground">
                  {product.tokens.toLocaleString()}부적
                </span>
                <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                  {product.label}
                </span>
              </span>
              <span className="text-base font-extrabold text-foreground">
                ₩{product.amount_krw.toLocaleString()}
              </span>
            </button>
          ))}
        </section>

        <section className="space-y-3 rounded-[var(--r-md)] border border-border bg-card p-3 shadow-[var(--e-1)]">
          <div className="flex items-center gap-2 px-1 text-sm font-extrabold text-foreground">
            <CreditCard size={18} />
            결제수단
          </div>
          <div
            id="payment-methods"
            className="min-h-[220px] rounded-[var(--r-sm)] border border-[var(--hairline)] bg-background p-2"
          />
          <div className="flex items-center gap-2 px-1 text-sm font-extrabold text-foreground">
            <ShieldCheck size={18} />
            약관 동의
          </div>
          <div
            id="payment-agreement"
            className="min-h-[96px] rounded-[var(--r-sm)] border border-[var(--hairline)] bg-background p-2"
          />
        </section>

        {displayedErrorKind === 'auth' && (
          <section
            role="alert"
            className="rounded-[var(--r-md)] border border-primary/25 bg-primary/10 p-4 shadow-[var(--e-1)]"
          >
            <p className="text-sm font-extrabold text-foreground">로그인이 필요해요</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              부적 충전은 로그인 후 이용할 수 있습니다.
            </p>
          </section>
        )}

        {displayedErrorKind === 'network' && (
          <ErrorCard code="NETWORK_OFFLINE" onRetry={order ? handleRequestPayment : handlePreparePayment} />
        )}

        {displayedErrorKind === 'not_payable' && (
          <section
            role="alert"
            className="rounded-[var(--r-md)] border border-destructive/25 bg-destructive/10 p-4 shadow-[var(--e-1)]"
          >
            <p className="text-sm font-extrabold text-foreground">이 주문은 다시 결제할 수 없어요</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              새 주문을 만들어 부적 충전을 다시 시작해주세요.
            </p>
          </section>
        )}

        {!authenticated ? (
          <Button
            type="button"
            className="h-12 w-full"
            onClick={() => router.push('/login?next=/payments/charge')}
          >
            로그인하고 충전
          </Button>
        ) : !hasMountedWidget ? (
          <Button
            type="button"
            className="h-12 w-full"
            disabled={preparing || !selectedProduct}
            onClick={handlePreparePayment}
          >
            {preparing
              ? '결제 준비 중…'
              : displayedErrorKind === 'not_payable'
                ? '새 주문으로 다시 충전'
                : `₩${selectedProduct.amount_krw.toLocaleString()} 결제수단 선택`}
          </Button>
        ) : (
          <Button
            type="button"
            className="h-12 w-full"
            disabled={widgetState === 'requesting'}
            onClick={handleRequestPayment}
          >
            {widgetState === 'requesting' ? '결제창 여는 중…' : `₩${order?.amount_krw.toLocaleString()} 결제하기`}
          </Button>
        )}
      </section>
    </main>
  );
}

function clearPaymentWidgetContainers() {
  document.getElementById('payment-methods')?.replaceChildren();
  document.getElementById('payment-agreement')?.replaceChildren();
}

function getChargeErrorKind(err: unknown): ChargeErrorKind {
  return err instanceof PaymentChargeError ? err.kind : 'network';
}

async function readApiErrorCode(response: Response): Promise<string | null> {
  const body = await response.json().catch(() => null);
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    body.error &&
    typeof body.error === 'object' &&
    'code' in body.error &&
    typeof body.error.code === 'string'
  ) {
    return body.error.code;
  }
  return null;
}
