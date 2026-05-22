# API Routes Spec

> 본 문서는 Next.js 15 App Router Route Handlers + Server Actions 전체 목록이다.
> 에러 코드는 `docs/specs/errors.md` 참조. 타입은 `docs/specs/contracts.md` 참조.

---

## 1. Route Inventory

| Route | Type | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| `POST /api/hapcards` | Route Handler | required | `{relation_id, mode, theory_profile_version, question_slot?}` | `HapcardResult` JSON | KST `target_date` 서버 산출, 날짜별 캐시/재분석 |
| `GET /api/today` | Route Handler | required | — | `DailyHap` JSON | lazy-first 캐시 (자정 만료) |
| `POST /actions/createRelation` | Server Action | required | `RelationCreate` | `RelationRow` | Zod validated, 닉네임만 저장 |
| `POST /api/hapcards/[id]/replay` | Route Handler | required | `{replay_reason?}` | `HapcardReplayResult` | 4p 차감, idempotency(jinjin_date UNIQUE), 보상 트랜잭션 |
| `POST /actions/archiveRelation` | Server Action | required | `{relationId}` | `{ok: true}` | soft delete (archived_at 설정) |
| `GET /api/me/wallet` | Route Handler | required | — | `WalletResponse` | 보유 부적, 최근 원장, 최근 사용량 |
| `POST /api/payments/init` | Route Handler | required | `{product_id}` | `PaymentInitResponse` | 서버 상품 카탈로그로 pending 주문 생성 |
| `GET /api/payments/order` | Route Handler | required | `?orderId=` | `PaymentOrderResponse` | checkout이 본인 주문 + Toss client key 조회 |
| `POST /api/payments/webhook` | Route Handler | Toss 재조회 검증 | toss payload | `200 OK` | 후속 환불/취소 자동화 |
| `POST /api/push/subscribe` | Route Handler | required | `PushSubscription` | `201` | FCM/Web Push 구독 등록 |
| `GET /api/og/hapcard/[id]` | Route Handler (next/og) | optional | — | `image/png` | 공유용 OG 이미지 생성 |
| `GET /admin/sre` | Server Component | admin role | — | HTML | SRE 대시보드 (§monitoring) |

---

## 2. Server Action vs Route Handler 선택 기준

### Server Action 사용 조건

- 폼 제출 또는 뮤테이션 (데이터 변경)
- Next.js `revalidatePath` / `revalidateTag` 호출이 필요한 경우
- 응답이 JSON이 아닌 redirect 또는 void
- 예: `createRelation`, `archiveRelation`

### Route Handler 사용 조건

- Streaming 응답이 필요한 경우 (SSE, ReadableStream)
- 외부 시스템 webhook 수신 (Toss Payments, FCM)
- 이미지/바이너리 응답 (next/og)
- 캐시 헤더를 정밀하게 제어해야 하는 경우
- 예: `/api/hapcard`, `/api/today`, `/api/payments/init`, `/api/payments/webhook`, `/api/og/*`

---

## 3. 에러 응답 형식

모든 Route Handler 에러 응답은 아래 형식을 따른다.
상세 에러 코드 목록은 `docs/specs/errors.md` 참조.

```typescript
// 에러 응답 공통 형식
interface ApiError {
  code: string;          // 예: "LLM_TIMEOUT", "INSUFFICIENT_TOKENS"
  message: string;       // 사용자 표시용 (한국어)
  detail?: unknown;      // 디버그용 (production 환경에서 omit)
}
```

### HTTP 상태코드 매핑

| 상태코드 | 사용 상황 |
|---|---|
| `200` | 성공 |
| `201` | 리소스 생성 성공 (push subscribe) |
| `400` | 잘못된 요청 (`INVALID_CHART`) |
| `402` | 결제 필요 (`INSUFFICIENT_TOKENS`) |
| `403` | 접근 거부 (`RLS_DENIED`) |
| `422` | 처리 불가 (`LLM_BANNED_PHRASE`) |
| `429` | 요청 제한 (`RATE_LIMITED`) |
| `500` | 서버 내부 오류 (`INTERNAL`) |
| `503` | 서비스 불가 (`LLM_ALL_PROVIDERS_DOWN`) |
| `504` | 게이트웨이 타임아웃 (`LLM_TIMEOUT`) |

---

## 4. 인증 패턴

모든 인증 필요 Route Handler는 아래 패턴을 따른다.

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Supabase 세션 검증
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return NextResponse.json(
      { code: 'RLS_DENIED', message: '접근 권한 없음' },
      { status: 403 }
    );
  }

  const userId = session.user.id;
  // ... 라우트 로직
}
```

Server Action 인증 패턴:

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function createRelation(formData: FormData) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  // Zod 검증 후 DB 삽입
}
```

---

## 5. Rate Limiting 정책

### anon_requests 테이블

```sql
-- 익명/인증 요청 제한 추적
CREATE TABLE anon_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  ip_hash     text NOT NULL,          -- IP 해시 (PII 최소화)
  route       text NOT NULL,          -- 예: "/api/hapcard"
  requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON anon_requests (user_id, route, requested_at);
CREATE INDEX ON anon_requests (ip_hash, route, requested_at);
```

### 제한 규칙

| 라우트 | 인증 사용자 | 익명/IP |
|---|---|---|
| `POST /api/hapcard` | 30 req/hour | 5 req/hour |
| `GET /api/today` | 60 req/hour | 10 req/hour |
| `POST /actions/createRelation` | 20 req/hour | — |
| `POST /api/payments/init` | 10 req/10min | — |
| `POST /api/payments/webhook` | — (Toss paymentKey 재조회) | — |

### 초과 시 응답

```typescript
return NextResponse.json(
  {
    code: 'RATE_LIMITED',
    message: '잠시 후 다시 시도해 주세요.',
    retry_after: 60,  // 초 단위
  },
  {
    status: 429,
    headers: { 'Retry-After': '60' }
  }
);
```

---

## 6. POST /api/hapcard (Streaming 상세)

### 요청

```typescript
interface HapcardRequest {
  relationId: string;
  mode: Mode;
}
```

### SSE 응답 스트림 형식

```
event: chunk
data: {"type":"body_summary","text":"..."}

event: chunk
data: {"type":"body_detail","section":1,"text":"..."}

event: chunk
data: {"type":"evidence","sipsin_mappings":[...]}

event: done
data: {"hapcardId":"...", "score":82, "expires_at":"..."}

event: error
data: {"code":"LLM_TIMEOUT","message":"잠시 후 다시"}
```

### LLM 폭포식 fallback

```
GPT-5o (primary)
  └─ timeout 20s → GPT-5 (secondary)
       └─ timeout 20s → Claude Sonnet 4.6 (fallback)
            └─ timeout 20s → 503 LLM_ALL_PROVIDERS_DOWN
```

PII 주의: LLM 페이로드에 `birth_date`, `nickname`, `email` 포함 금지 (CLAUDE.md §5).
허용 필드: `chart_core` + `question_slot` + `theory_profile.profile_version`.

---

## 7. 결제 라우트 상세

### v1 지갑/충전 라우트

1. `POST /api/payments/init`: `product_id`만 받고 서버의 상품 카탈로그에서 금액·부적 수를 결정한다.
2. `/payment/checkout`: TossPayments V2 `loadTossPayments → widgets({ customerKey }) → setAmount → renderPaymentMethods/renderAgreement → requestPayment`.
3. `/payment/success`: successUrl의 `amount`를 서버 저장 주문 금액과 먼저 비교한 뒤, 저장 금액으로 Toss confirm API를 호출하고 `confirm_token_purchase` RPC로 `payments.status='confirmed'`와 `token_ledger.reason='purchase'` 충전을 한 트랜잭션으로 처리한다.
4. 중복 success redirect는 `toss_order_id`/confirmed 상태 기준으로 부적 중복 지급 없이 멱등 처리한다.

### POST /api/payments/webhook 상세

Webhook은 후속 환불·취소 자동화 단계에서 활성화한다.

### Toss Payments webhook 검증

### webhook 처리 흐름

TossPayments V2 최신 LLM Quick Reference 기준으로 일반 결제 webhook(`PAYMENT_STATUS_CHANGED`, `DEPOSIT_CALLBACK`, `CANCEL_STATUS_CHANGED`)은 HMAC signature header 검증 대상이 아니다. webhook payload의 `paymentKey`로 Toss Payments 결제 조회 API를 다시 호출해 상태를 검증한다.

1. payload에서 `paymentKey` 추출
2. `GET /v1/payments/{paymentKey}` 재조회
3. 조회 결과의 `paymentKey` + `orderId` + `amount` + `status` 일치 검증
4. 환불·취소 자동화 정책 결정 후 DB 반영
5. `200 OK` 반환 (5초 이내 — Toss 타임아웃)

---

## 8. GET /admin/sre 접근 제어

```typescript
// admin role 검증 (Supabase custom claim)
const { data: { user } } = await supabase.auth.getUser();
const isAdmin = user?.app_metadata?.role === 'admin';

if (!isAdmin) notFound();  // 404로 존재 자체 숨김
```
