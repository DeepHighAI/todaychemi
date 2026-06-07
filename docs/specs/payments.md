# Toss Payments Integration Spec

> Phase 1 KR 결제 전용. Phase 3 SEA 확장 시 Stripe 추가 (AGENTS.md §4).
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
TOSS_CLIENT_KEY=test_gck_...            # Payment Widget client key (서버 API가 checkout payload로 전달)
TOSS_SECRET_KEY=test_gsk_...            # Payment Widget secret key, 서버 전용 (결제 승인/취소)
# 임시 호환 alias: TOSS_PAYMENTS_CLIENT_KEY / TOSS_PAYMENTS_SECRET_KEY
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
  orderName: string;        // 예: "케미카드 결제"
  amount: number;           // 원 단위 (KRW)
  customerKey: string;      // 서버가 생성·저장한 UUID 기반 Toss customerKey
  clientKey: string;        // TOSS_CLIENT_KEY를 서버 API로 전달
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
        successUrl: `${window.location.origin}/api/payments/feature/confirm`,
        failUrl: `${window.location.origin}/payments/fail`,
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

### 2.2 결제 승인 Route Handler (app/api/payments/feature/confirm/route.ts)

```typescript
import { confirmFeaturePaymentForUser } from '@/lib/payments/feature-complete';

export async function GET(request: NextRequest) {
  const paymentKey = request.nextUrl.searchParams.get('paymentKey');
  const orderId = request.nextUrl.searchParams.get('orderId');
  const amount = Number(request.nextUrl.searchParams.get('amount'));

  // amount는 successUrl 값 그대로 신뢰하지 않는다.
  // confirmFeaturePaymentForUser가 서버 저장 주문 금액과 먼저 비교한 뒤,
  // 저장 금액으로 Toss confirm을 호출하고 기능 잠금 해제만 확정한다.
  await confirmFeaturePaymentForUser({ userId, paymentKey, orderId, amount, feature, ref });

  const target = new URL(next ?? '/feed', request.url);
  target.searchParams.set('paid', ref);
  return NextResponse.redirect(target, 303);
}
```

### 2.3 현재 구현 API

| 라우트 | 역할 |
|---|---|
| `GET /api/me/wallet` | 보유 부적, 최근 원장, 이번 달 사용량 + 최근 14일 사용량 조회 |
| `POST /api/payments/feature/init` | 기능(`hapcard`/`whatif`/`replay`)과 `feature_ref` 소유권을 확인하고 pending feature payment를 생성 또는 재사용 |
| `GET /api/payments/feature/confirm?paymentKey=&orderId=&amount=` | 서버 저장 금액 검증 후 Toss confirm + `confirm_feature_payment` RPC로 기능 결제 확정 |
| `FeaturePaySheet` | 기능 화면 안에서 V2 Payment Widget 렌더링 및 `requestPayment` |
| `GET /payments/fail` | 실패 코드 표시 및 pending 결제 실패 기록 |

기능 가격 카탈로그: 케미카드 1,000원, 만약에 우리 800원, 케미 다시 맞추기 600원 (2026-06-07 §1.1 D6 개정 — 앱인토스 IAP 수수료 반영, 웹·미니앱 통일). 단일 출처는 `src/lib/payments/feature-prices.ts`.

무료 부적 잔액이 충분하면 케미카드 `10p`, 케미 다시 맞추기 `6p`, 만약에 우리 `8p`를 서버에서 `token_ledger` 차감/환불/idempotency로 처리한다(1부적 = 100원 등가). 잔액이 부족하면 현금 결제 후 기능 잠금 해제만 확정하며, 유료 결제로 `token_ledger.reason='purchase'` 적립을 만들지 않는다. 캐시 적중 또는 이미 결제 완료된 `feature_ref`는 신규 차감/결제하지 않는다.

원자성은 **모델 C**(선생성 → 성공 시 결제): 본문을 먼저 생성·보류한 뒤 무료 차감 불가 시 402로 결제를 요구하고, confirm 후 동일 요청 재호출로 잠금이 해제된다(빌드 실패 시 `charged` 플래그로 환불). 미결제 선생성 누적은 일일 `CASH_GEN_DAILY_LIMIT`(기본 5, 초과 시 429)로 제한한다. **잠금 단일 진실은 `isFeatureUnlocked`** — 본문을 반환하는 GET 라우트(`ohaeng-interpretation`·`role-analysis`)도 hapcard `cache_key`로 게이트를 통과해야 한다(미결제 본문 유출 차단). `snapshots`·OG·share는 점수·메타데이터만 노출하므로 게이트하지 않는다. 상세 결정: `docs/adr/ADR-039-pay-per-use-billing.md`.

---

## 3. Webhook Handler

이번 MVP pay-per-use 구현의 1차 진실 경로는 `/api/payments/feature/confirm` redirect confirm이다. `POST /api/payments/webhook`은 가상계좌·환불·취소 자동화 단계에서 활성화한다.

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

## 4. 환불 API (MVP 제외, 후속)

```typescript
// lib/toss/refund.ts
interface RefundParams {
  paymentKey: string;
  cancelReason: string;
  cancelAmount?: number;    // 부분 환불 시 금액 (미입력 시 전액)
}

async function refundPayment({ paymentKey, cancelReason, cancelAmount }: RefundParams) {
  const credentials = Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64');

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
  toss_customer_key text,                     -- 서버가 생성·저장한 Toss customerKey
  toss_payment_key text UNIQUE,              -- 승인 전 NULL 가능
  product_id       text,
  amount_krw       integer NOT NULL,         -- KRW 단위
  token_amount     integer,                  -- legacy token-pack only; feature_use에서는 NULL
  charge_type      text NOT NULL DEFAULT 'token_charge',  -- 'token_charge'(legacy) | 'feature_use'
  feature_id       text,                     -- 'hapcard' | 'whatif' | 'replay' (feature_use)
  feature_ref      text,                     -- feature_use unlock ref: cache_key | replay:{id}:{date}
  status           text NOT NULL,            -- 'pending' | 'confirmed' | 'failed' | 'refunded' | 'tampered' | 'invalid'
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
  reason        text NOT NULL,          -- 'purchase' | 'hapcard_use' | 'hapcard_refund' | 'replay_use' | 'replay_refund' | 'whatif_use' | 'whatif_refund' | 'refund' | 'bonus'
  reference_id  text,                   -- payment_id, hapcard_id, daily_login:<YYYY-MM-DD>, signup:<user_id>, share:<share_id>
  balance_after integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 기능 결제 확정은 confirm_feature_payment RPC로 처리한다.
-- 중복 success redirect는 toss_order_id/status/feature_ref 기준으로 멱등 처리한다.
-- pay-per-use 현금 결제는 token_ledger purchase 적립을 만들지 않고 기능 unlock만 확정한다.
```

무료 부적 보상은 결제 상품이 아니며 모두 `reason='bonus'`로 기록한다. `award_free_talisman_session_rewards`는 KST 일일 첫 인증 앱 진입 `+1`, 정책 기준일 이후 신규 온보딩 완료 사용자 가입 `+5`를 멱등 지급한다. 공유 보상은 Kakao webhook으로 서버 검증된 공유만 `award_hapcard_share_reward`가 `delta=+1`로 기록하며 제한은 사용자+hapcard당 1회, KST 기준 하루 최대 5회다.

---

## 6. 테스트 카드 + Sandbox 가이드

### Toss 테스트 카드 (sandbox 환경)

| 카드번호 | 용도 |
|---|---|
| `4330000000000000` | 일반 결제 성공 |
| `4000000000000002` | 잔액 부족 실패 |
| `4000000000000028` | 도난 카드 실패 |

> 테스트 환경에서는 `test_gck_*` / `test_gsk_*` 결제위젯 키 사용. 실 결제 없음.

### Sandbox 환경 확인

```bash
# .env.local sandbox 설정
TOSS_CLIENT_KEY=test_gck_...
TOSS_SECRET_KEY=test_gsk_...
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

- [ ] `test_gck_*` → `live_gck_*` 키 교체 (Vercel Production 환경변수)
- [ ] `test_gsk_*` → `live_gsk_*` 키 교체 (Vercel Production 환경변수)
- [ ] 환불·취소 자동화 활성화 시 Toss 대시보드 → webhook URL 프로덕션 URL로 변경
- [ ] Toss 대시보드 → 사업자 정보 등록 완료
- [x] 환불 정책 약관 페이지 등록 (`/legal/refund`, `/terms/refund` alias)
- [ ] `/api/payments/feature/confirm` 서버 저장 금액 검증 확인 (클라이언트 successUrl amount 조작 방지)
- [ ] payments 테이블 RLS 정책 확인 (user_id 기준)
- [ ] `/cso` 스킬 보안 감사 통과
- [ ] `/qa` 스킬 결제 플로우 E2E 통과
- [ ] Sentry 결제 관련 에러 알림 설정
- [ ] 일일 결제 금액 이상 알림 설정 (Discord #critical)
