# Toss Payments Integration Spec

> Phase 1 KR 결제 전용. Phase 3 SEA 확장 시 Stripe 추가 (CLAUDE.md §4).
> ADR-037 스택 잠금: `@tosspayments/payment-widget-sdk` 고정.

---

## 1. SDK 정보

```bash
# 설치
pnpm add @tosspayments/payment-widget-sdk

# 버전 잠금 (pnpm.lock으로 고정)
# "@tosspayments/payment-widget-sdk": "^0.12.x"
```

환경변수:

```bash
TOSS_PAYMENTS_CLIENT_KEY=test_ck_...    # 클라이언트 (NEXT_PUBLIC 아님 — 서버에서 widget 초기화)
TOSS_PAYMENTS_SECRET_KEY=test_sk_...    # 서버 전용 (결제 승인/취소)
TOSS_WEBHOOK_SECRET=whsec_...           # webhook 서명 검증
```

---

## 2. 결제 위젯 통합

### 2.1 결제 위젯 초기화 (Client Component)

```typescript
'use client';

import { loadPaymentWidget, PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';
import { useEffect, useRef } from 'react';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;

interface PaymentWidgetProps {
  orderId: string;
  orderName: string;        // 예: "합포인트 30p"
  amount: number;           // 원 단위 (KRW)
  customerKey: string;      // user_id (익명화된 식별자)
  onSuccess: (paymentKey: string) => void;
  onError: (code: string, message: string) => void;
}

export function PaymentWidget({
  orderId, orderName, amount, customerKey, onSuccess, onError
}: PaymentWidgetProps) {
  const widgetRef = useRef<PaymentWidgetInstance | null>(null);

  useEffect(() => {
    async function initWidget() {
      const widget = await loadPaymentWidget(CLIENT_KEY, customerKey);
      widgetRef.current = widget;

      // 결제 수단 위젯 렌더링
      await widget.renderPaymentMethods('#payment-method', { value: amount });
      // 이용약관 위젯 렌더링
      await widget.renderAgreement('#agreement');
    }

    initWidget();
  }, [customerKey, amount]);

  const handlePayment = async () => {
    if (!widgetRef.current) return;

    try {
      await widgetRef.current.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: undefined,   // PII 수집 금지 (CLAUDE.md §5)
        customerName: undefined,    // PII 수집 금지 (CLAUDE.md §5)
      });
    } catch (err) {
      if (err instanceof Error) {
        onError('PAYMENT_FAILED', err.message);
      }
    }
  };

  return (
    <div>
      <div id="payment-method" />
      <div id="agreement" />
      <button onClick={handlePayment}>결제하기</button>
    </div>
  );
}
```

### 2.2 결제 성공 페이지 (app/payment/success/page.tsx)

```typescript
import { redirect } from 'next/navigation';
import { confirmPayment } from '@/actions/confirmPayment';

interface SuccessPageProps {
  searchParams: {
    paymentKey: string;
    orderId: string;
    amount: string;
  };
}

export default async function PaymentSuccessPage({ searchParams }: SuccessPageProps) {
  const { paymentKey, orderId, amount } = searchParams;

  // 서버에서 결제 최종 승인
  const result = await confirmPayment({ paymentKey, orderId, amount: Number(amount) });

  if (!result.ok) redirect(`/payment/fail?code=${result.error}`);

  redirect('/feed?payment=success');
}
```

---

## 3. 결제 승인 Webhook Handler

`POST /api/payments/webhook`

### 3.1 서명 검증 + 처리 흐름

```typescript
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';  // Edge runtime은 crypto 미지원

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get('toss-signature') ?? '';

  // 1단계: Toss 서명 검증
  if (!verifyTossSignature(payload, signature, process.env.TOSS_WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(payload);

  // 2단계: 이벤트 타입 처리
  switch (event.eventType) {
    case 'PAYMENT_STATUS_CHANGED':
      await handlePaymentStatusChanged(event.data);
      break;
    default:
      // 알 수 없는 이벤트 — 무시하고 200 반환 (Toss 재시도 방지)
      break;
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

function verifyTossSignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function handlePaymentStatusChanged(data: {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  approvedAt: string;
}) {
  if (data.status !== 'DONE') return;  // 완료 상태만 처리

  const supabase = createClient();

  // 3단계: payments 테이블 INSERT (멱등성: orderId 중복 시 skip)
  const { error: paymentError } = await supabase
    .from('payments')
    .upsert({
      order_id: data.orderId,
      payment_key: data.paymentKey,
      amount: data.totalAmount,
      status: 'completed',
      approved_at: data.approvedAt,
    }, { onConflict: 'order_id' });

  if (paymentError) throw paymentError;

  // 4단계: token_ledger 크레딧 추가
  const tokens = amountToTokens(data.totalAmount);

  await supabase.from('token_ledger').insert({
    order_id: data.orderId,
    delta: tokens,
    reason: 'purchase',
  });
}

// 원 → 포인트 변환 (예: 1,000원 = 10p)
function amountToTokens(amountKRW: number): number {
  return Math.floor(amountKRW / 100);
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
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  order_id      text UNIQUE NOT NULL,   -- 토스 orderId (멱등성 키)
  payment_key   text UNIQUE,            -- 토스 paymentKey
  amount        integer NOT NULL,       -- KRW 단위
  status        text NOT NULL,          -- 'pending' | 'completed' | 'cancelled' | 'refunded'
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 포인트 원장 (double-entry 스타일)
CREATE TABLE token_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  order_id    text REFERENCES payments(order_id),
  delta       integer NOT NULL,         -- 양수: 충전, 음수: 사용
  reason      text NOT NULL,            -- 'purchase' | 'hapcard_use' | 'replay_use' | 'replay_refund' | 'refund' | 'bonus'
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 현재 잔액 (집계 뷰)
CREATE VIEW user_token_balance AS
SELECT user_id, SUM(delta) AS balance
FROM token_ledger
GROUP BY user_id;
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
- [ ] Toss 대시보드 → webhook URL 프로덕션 URL로 변경
- [ ] Toss 대시보드 → 사업자 정보 등록 완료
- [ ] 환불 정책 약관 페이지 등록 (`/terms/refund`)
- [ ] 결제 금액 × 수량 조합 서버 검증 로직 확인 (클라이언트 조작 방지)
- [ ] payments 테이블 RLS 정책 확인 (user_id 기준)
- [ ] `/cso` 스킬 보안 감사 통과
- [ ] `/qa` 스킬 결제 플로우 E2E 통과
- [ ] Sentry 결제 관련 에러 알림 설정
- [ ] 일일 결제 금액 이상 알림 설정 (Discord #critical)
