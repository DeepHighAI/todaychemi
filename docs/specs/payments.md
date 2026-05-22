# Toss Payments Integration Spec

> Phase 1 KR 결제 전용. Phase 3 SEA 확장 시 Stripe 추가 (CLAUDE.md §4).
> ADR-037 스택 잠금: TossPayments V2 `@tosspayments/tosspayments-sdk` 사용.

---

## 1. SDK 정보

```bash
# 설치
pnpm add @tosspayments/tosspayments-sdk

# 버전 잠금 (pnpm.lock으로 고정)
# "@tosspayments/tosspayments-sdk": "^2.7.x"
```

환경변수:

```bash
TOSS_PAYMENTS_CLIENT_KEY=test_ck_...    # 클라이언트 (NEXT_PUBLIC 아님 — 서버에서 widget 초기화)
TOSS_PAYMENTS_SECRET_KEY=test_sk_...    # 서버 전용 (결제 승인/취소)
```

참조 기준: TossPayments V2 [LLMs Guide](https://docs.tosspayments.com/guides/v2/get-started/llms-guide), [LLM Quick Reference](https://docs.tosspayments.com/guides/v2/get-started/llms-quick-reference), [llms.txt](https://docs.tosspayments.com/llms.txt).

---

## 2. 결제 위젯 통합

### 2.1 결제 위젯 초기화 (Client Component)

```typescript
'use client';

import { loadTossPayments, type TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk';
import { useEffect, useRef } from 'react';

interface PaymentWidgetProps {
  orderId: string;
  orderName: string;        // 예: "부적 55개"
  amount: number;           // 원 단위 (KRW)
  customerKey: string;      // user_id (익명화된 식별자)
  clientKey: string;        // TOSS_PAYMENTS_CLIENT_KEY를 서버 API로 전달
}

export function PaymentWidget({ orderId, orderName, amount, customerKey, clientKey }: PaymentWidgetProps) {
  const widgetRef = useRef<TossPaymentsWidgets | null>(null);

  useEffect(() => {
    async function initWidget() {
      const tossPayments = await loadTossPayments(clientKey);
      const widgets = tossPayments.widgets({ customerKey });
      widgetRef.current = widgets;

      await widgets.setAmount({ currency: 'KRW', value: amount });
      await widgets.renderPaymentMethods({ selector: '#payment-methods', variantKey: 'DEFAULT' });
      await widgets.renderAgreement({ selector: '#payment-agreement', variantKey: 'AGREEMENT' });
    }

    void initWidget();
  }, [amount, clientKey, customerKey]);

  const handlePayment = async () => {
    if (!widgetRef.current) return;

    try {
      await widgetRef.current.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch {
      // UI에서 재시도 안내
    }
  };

  return (
    <div>
      <div id="payment-methods" />
      <div id="payment-agreement" />
      <button onClick={handlePayment}>결제하기</button>
    </div>
  );
}
```

### 2.2 결제 성공 페이지 (app/payment/success/page.tsx)

```typescript
import { redirect } from 'next/navigation';
import { confirmPaymentForUser } from '@/lib/payments/complete';

interface SuccessPageProps {
  searchParams: {
    paymentKey: string;
    orderId: string;
    amount: string;
  };
}

export default async function PaymentSuccessPage({ searchParams }: SuccessPageProps) {
  const { paymentKey, orderId, amount } = searchParams;

  // amount는 successUrl 값 그대로 신뢰하지 않는다.
  // confirmPaymentForUser가 서버 저장 주문 금액과 먼저 비교한 뒤, 저장 금액으로 Toss confirm을 호출한다.
  await confirmPaymentForUser({ userId, paymentKey, orderId, amount: Number(amount) });

  redirect('/me?payment=success');
}
```

### 2.3 현재 구현 API

| 라우트 | 역할 |
|---|---|
| `GET /api/me/wallet` | 보유 부적, 최근 원장, 최근 사용량 조회 |
| `POST /api/payments/init` | 서버 상품 카탈로그 기준 pending 주문 생성 |
| `GET /api/payments/order?orderId=` | checkout 페이지가 본인 주문 + Toss client key 조회 |
| `/payment/checkout` | V2 widget 렌더링 및 `requestPayment` |
| `/payment/success` | Toss confirm API 호출 후 `confirm_token_purchase` RPC 실행 |
| `/payment/fail` | 실패 코드 표시 및 pending 결제 실패 기록 |

상품 카탈로그: `tokens_10` 10부적/1,000원, `tokens_50` 55부적/4,500원, `tokens_100` 120부적/8,000원.

---

## 3. Webhook Handler

이번 v1 지갑 구현의 1차 진실 경로는 `/payment/success` redirect confirm이다. `POST /api/payments/webhook`은 환불·취소 자동화 단계에서 활성화한다.

`POST /api/payments/webhook`

### 3.1 일반 결제 webhook 검증 흐름

TossPayments V2 LLM Quick Reference 기준으로 일반 결제 webhook(`PAYMENT_STATUS_CHANGED`, `DEPOSIT_CALLBACK`, `CANCEL_STATUS_CHANGED`)에는 `tosspayments-webhook-signature` HMAC 검증을 적용하지 않는다. webhook payload의 `paymentKey`로 Toss Payments 결제 조회 API(`GET /v1/payments/{paymentKey}`)를 다시 호출해 상태를 검증한다.

```typescript
import { NextResponse } from 'next/server';
import { getTossPayment } from '@/lib/payments/toss-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const event = await req.json();

  switch (event.eventType) {
    case 'PAYMENT_STATUS_CHANGED':
    case 'DEPOSIT_CALLBACK':
    case 'CANCEL_STATUS_CHANGED':
      await handlePaymentWebhook(event.data);
      break;
    default:
      // 알 수 없는 이벤트 — 무시하고 200 반환 (Toss 재시도 방지)
      break;
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function handlePaymentWebhook(data: {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
}) {
  const payment = await getTossPayment(data.paymentKey);
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');
  if (payment.orderId !== data.orderId || payment.totalAmount !== data.totalAmount) {
    throw new Error('PAYMENT_WEBHOOK_MISMATCH');
  }

  // 환불·취소 자동화 정책 결정 후 DB 반영 로직을 추가한다.
}
```

---

## 4. 환불 API

```typescript
// lib/toss/refund.ts
interface RefundParams {
  paymentKey: string;
  cancelReason: string;
  cancelAmount?: number;    // 부분 환불 시 금액 (미입력 시 전액)
}

async function refundPayment({ paymentKey, cancelReason, cancelAmount }: RefundParams) {
  const credentials = Buffer.from(`${process.env.TOSS_PAYMENTS_SECRET_KEY}:`).toString('base64');

  const res = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cancelReason,
      ...(cancelAmount !== undefined && { cancelAmount }),
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Refund failed: ${err.code} - ${err.message}`);
  }

  return res.json();
}
```

---

## 5. payments + token_ledger 테이블 연동

`docs/specs/db_schema.md` 상세 스키마 참조. 핵심 구조:

```sql
-- 결제 기록
CREATE TABLE payments (
  payment_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.users(user_id),
  toss_order_id    text UNIQUE NOT NULL,     -- Toss orderId (멱등성 키)
  toss_payment_key text UNIQUE,              -- 승인 전 NULL 가능
  product_id       text,
  amount_krw       integer NOT NULL,         -- KRW 단위
  token_amount     integer NOT NULL,         -- 충전 부적 수
  status           text NOT NULL,            -- 'pending' | 'confirmed' | 'failed' | 'refunded'
  failure_code     text,
  failure_message  text,
  receipt_url      text,
  confirmed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 포인트 원장 (double-entry 스타일)
CREATE TABLE token_ledger (
  ledger_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(user_id),
  delta         integer NOT NULL,       -- 양수: 충전, 음수: 사용
  reason        text NOT NULL,          -- 'purchase' | 'hapcard_use' | 'replay_use' | 'replay_refund' | 'whatif_use' | 'whatif_refund' | 'refund' | 'bonus'
  reference_id  text,                   -- payment_id 또는 hapcard_id
  balance_after integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 결제 확정은 confirm_token_purchase RPC로만 처리한다.
-- 중복 success redirect는 toss_order_id/status 기준으로 멱등 처리한다.
```

---

## 6. 테스트 카드 + Sandbox 가이드

### Toss 테스트 카드 (sandbox 환경)

| 카드번호 | 용도 |
|---|---|
| `4330000000000000` | 일반 결제 성공 |
| `4000000000000002` | 잔액 부족 실패 |
| `4000000000000028` | 도난 카드 실패 |

> 테스트 환경에서는 `test_ck_*` / `test_sk_*` 키 사용. 실 결제 없음.

### Sandbox 환경 확인

```bash
# .env.local sandbox 설정
TOSS_PAYMENTS_CLIENT_KEY=test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq
TOSS_PAYMENTS_SECRET_KEY=test_sk_D5GePWvyJnrK0W0k6q8gLzN97Eoq
```

### Webhook 로컬 테스트

```bash
# Toss 대시보드에서 webhook URL 설정:
# https://<ngrok-url>/api/payments/webhook

# ngrok 로컬 터널
npx ngrok http 3000
```

---

## 7. Phase 1 출시 전 체크리스트

- [ ] `test_ck_*` → `live_ck_*` 키 교체 (Vercel Production 환경변수)
- [ ] `test_sk_*` → `live_sk_*` 키 교체 (Vercel Production 환경변수)
- [ ] 환불·취소 자동화 활성화 시 Toss 대시보드 → webhook URL 프로덕션 URL로 변경
- [ ] Toss 대시보드 → 사업자 정보 등록 완료
- [ ] 환불 정책 약관 페이지 등록 (`/terms/refund`)
- [ ] 결제 금액 × 수량 조합 서버 검증 로직 확인 (클라이언트 조작 방지)
- [ ] payments 테이블 RLS 정책 확인 (user_id 기준)
- [ ] `/cso` 스킬 보안 감사 통과
- [ ] `/qa` 스킬 결제 플로우 E2E 통과
- [ ] Sentry 결제 관련 에러 알림 설정
- [ ] 일일 결제 금액 이상 알림 설정 (Discord #critical)
