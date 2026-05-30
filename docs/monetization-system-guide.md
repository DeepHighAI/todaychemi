# 부적(토큰) 유료화 시스템 — 개발 가이드라인

> **이 파일 한 장으로 Next.js App Router + Supabase + TossPayments 스택에서 동일한 인앱 화폐(token) 유료화 시스템을 재현할 수 있도록 설계된 자기완결적 가이드.**
> UI 스타일링(CSS/Tailwind/Framer Motion) 제외. 백엔드, DB, 프론트엔드 로직, 계약(contract)에만 집중.

---

## 0. 개요

### 0.1 시스템 구성 — 두 가지 독립 레이어

| 레이어 | 명칭 | 설명 | 결제 연동 |
|--------|------|------|----------|
| **(A) 유료 토큰 시스템** | Token / "부적" | 인앱 화폐. TossPayments(웹)·IAP(네이티브)로 구매 → 기능 사용 시 차감 → 광고·로그인·가입으로 무료 적립 | 있음 |
| **(B) 무료 리추얼 UX** | 부적 쓰기 | 매일 한자 1자를 따라 쓰는 engagement 기능. `localStorage`만 사용, 서버·결제 전무 | 없음 |

두 시스템은 독립적이다. (A)는 유료화 백본, (B)는 리텐션 기능. 원하면 (B) 완료 콜백(`onComplete`)에 (A) 로직을 연결할 수 있다.

### 0.2 스택 전제

- **Next.js 16 App Router** (TypeScript strict)
- **Supabase** (PostgreSQL + RLS + SECURITY DEFINER RPC + `@supabase/ssr`)
- **TossPayments V2** (`@tosspayments/tosspayments-sdk`)
- **Zustand 5** + persist middleware (localStorage)
- **Capacitor 8** — 네이티브 IAP (웹은 TossPayments)

### 0.3 환경변수 요약

| 변수 | 위치 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | server+client | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | server+client | Supabase anon key (RLS 적용) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | RLS 우회, `createServiceClient` 전용 |
| `TOSS_CLIENT_KEY` | server+client 전달 | TossPayments 위젯 클라이언트 키. 서버 API 응답으로만 클라이언트에 전달 |
| `TOSS_SECRET_KEY` | server only | TossPayments confirm/조회 API |
| `CSRF_SECRET` | server only | HMAC 서명 키 (32자 이상 랜덤) |
| `ADMIN_SECRET_KEY` | server | 관리자 수동 토큰 지급 |

무료 부적 지급 수량은 환경변수가 아니라 RPC 정책값으로 고정한다: KST 일일 첫 인증 앱 진입 `+1`, 정책 기준일(`2026-05-25T00:00:00+09:00`) 이후 신규 온보딩 완료 가입 `+5`, 서버가 성공을 검증할 수 있는 Kakao webhook 공유 `+1`.

---

## 1. 아키텍처 핵심 원칙 (반드시 먼저 읽기)

### 1.1 토큰 = 단일 통화, 단일 경로

**모든 토큰 잔액 변경은 `adjust_tokens()` RPC 한 경로로만.** `user_tokens`·`token_transactions`를 직접 INSERT/UPDATE하지 않는다.

```
토큰 조작 경로: 서버 핸들러 → createServiceClient() → supabase.rpc('adjust_tokens', {...})
```

### 1.2 무결성 경계

```
┌──────────────────────────────────────────────────────────────────┐
│  user_tokens.balance  CHECK (balance >= 0)  ← DB 레벨 최종 방어선  │
│  RLS: SELECT only (authenticated role)                            │
│  쓰기 정책 없음 → adjust_tokens() SECURITY DEFINER만 가능           │
│  GRANT EXECUTE ON adjust_tokens TO service_role  (only)           │
└──────────────────────────────────────────────────────────────────┘
```

- `createClient()` (anon key, RLS 적용) → 사용자 데이터 읽기 전용
- `createServiceClient()` (service_role key, RLS 우회) → 토큰 조작 필수. **사용자 데이터 일반 조회에는 절대 사용 금지**

### 1.3 멱등성 (Idempotency)

| 레일 | 멱등 키 | 구현 방식 |
|------|---------|---------|
| 결제 완료 | `paymentKey` | `payment_events.id = paymentKey` PK 중복 방지 |
| 주문 기록 | `paymentKey` | `orders.portone_payment_id` UNIQUE |
| 웹훅 이벤트 | `${paymentKey}::webhook.${status}` | `payment_events.id` PK |
| 토큰 차감 | `reference_id + KST 자정 window` | `token_transactions` count 조회 |
| 일일 적립 | `type + KST 자정 window` | `token_transactions` count 조회 |

### 1.4 HTTP 상태 코드 규약

| 코드 | 의미 |
|------|------|
| 400 | 유효성 검증 실패 / 결제 실패 |
| 401 | 인증 없음 |
| 402 | 잔액 부족 |
| 403 | CSRF 토큰 오류 / 관리자 권한 없음 |
| 429 | Rate Limit / 일일 한도 초과 |
| 500 | RPC 오류 / 예외 |

### 1.5 API 파이프라인 실제 순서

```
Rate Limit (선택) → CSRF 검증 → Auth 검증 → Body Parse/Validate → Business Logic → Response
```

> ⚠️ 주의: CLAUDE.md에 "Auth→CSRF" 순서로 기재되어 있으나 **실제 소스 코드는 CSRF가 먼저**다. 새 프로젝트 작성 시 순서 통일 권장.

---

## 2. 데이터 모델 — DB Schema

**마이그레이션 적용 순서** (의존성 있음):

```
001_initial_schema.sql   ← auth.users, update_updated_at_column() 트리거
          ↓
012_pivot_tables.sql     ← user_tokens, token_transactions, adjust_tokens()
          ↓
016_payment_tables.sql   ← orders, payment_events
          ↓
011_rate_limit_table.sql ← rate_limits (rate limiting 사용 시)
```

### 2.1 user_tokens

**원본**: `supabase/migrations/012_pivot_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS public.user_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 1:1 관계 (사용자당 행 1개, UNIQUE 제약)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- 토큰 잔액: 음수 불가 — DB 레벨 최종 방어선
    balance INT DEFAULT 0 CHECK (balance >= 0),
    total_earned INT DEFAULT 0,
    total_spent  INT DEFAULT 0,

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON public.user_tokens(user_id);

-- RLS: SELECT만 허용, 쓰기 정책 없음
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own token balance"
    ON public.user_tokens FOR SELECT
    USING (auth.uid() = user_id);

-- updated_at 자동 갱신 (update_updated_at_column()은 001에서 생성)
CREATE TRIGGER update_user_tokens_updated_at
    BEFORE UPDATE ON public.user_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- GRANTS
GRANT SELECT ON public.user_tokens TO authenticated;
GRANT ALL ON public.user_tokens TO service_role;
```

### 2.2 token_transactions

**원본**: `supabase/migrations/012_pivot_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS public.token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),

    amount INT NOT NULL,           -- 양수=획득, 음수=차감
    type TEXT NOT NULL CHECK (type IN (
        'purchase',
        'hapcard_use',
        'replay_use',
        'replay_refund',
        'whatif_use',
        'whatif_refund',
        'refund',
        'bonus'
    )),
    description TEXT,
    reference_id TEXT,             -- daily_login:<date>, signup:<user_id>, share:<share_id> 등

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id
    ON public.token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_created
    ON public.token_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type
    ON public.token_transactions(type);
-- reference_id 부분 인덱스 (UNIQUE 아님 — 같은 reference_id로 여러 행 가능)
CREATE INDEX IF NOT EXISTS idx_token_transactions_reference
    ON public.token_transactions(reference_id) WHERE reference_id IS NOT NULL;

-- RLS: SELECT만 허용, INSERT는 RPC 통해서만
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own token transactions"
    ON public.token_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- GRANTS
GRANT SELECT ON public.token_transactions TO authenticated;
GRANT ALL ON public.token_transactions TO service_role;
```

### 2.3 adjust_tokens() RPC

**원본**: `supabase/migrations/012_pivot_tables.sql`

```sql
CREATE OR REPLACE FUNCTION public.adjust_tokens(
    p_user_id     UUID,
    p_amount      INT,
    p_type        TEXT,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- user_tokens 행이 없으면 자동 생성 (upsert)
    INSERT INTO public.user_tokens (user_id, balance, total_earned, total_spent)
    VALUES (p_user_id, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- 잔액 및 누적 합계 원자적 업데이트
    UPDATE public.user_tokens SET
        balance      = balance + p_amount,
        total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END,
        total_spent  = CASE WHEN p_amount < 0 THEN total_spent + ABS(p_amount) ELSE total_spent END,
        updated_at   = NOW()
    WHERE user_id = p_user_id;

    -- 불변 거래 로그 기록
    INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
    VALUES (p_user_id, p_amount, p_type, p_description, p_reference_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 실행 권한: service_role 전용 (authenticated role에는 부여하지 않음)
GRANT EXECUTE ON FUNCTION public.adjust_tokens TO service_role;
```

> ⚠️ `balance >= 0` CHECK가 overdraw 시 DB 레벨에서 에러를 던진다. RPC 호출 전 애플리케이션 레벨에서 잔액 확인 후 402를 반환하는 것이 UX상 권장된다(§5.1 참조).

### 2.4 orders (결제 주문 기록)

**원본**: `supabase/migrations/016_payment_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 컬럼명 레거시 주의: portone_payment_id이지만 실제론 Toss paymentKey 저장
    portone_payment_id TEXT NOT NULL UNIQUE,
    product_id   TEXT NOT NULL,   -- e.g. 'tokens_10', 'premium_monthly'
    product_type TEXT NOT NULL CHECK (product_type IN ('consumable', 'subscription')),
    amount   INT  NOT NULL,       -- KRW 단위 결제 금액
    currency TEXT NOT NULL DEFAULT 'krw',
    status   TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'cancelled', 'refunded')),

    paid_at    TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id    ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- RLS: service_role만 접근 (사용자 직접 조회 불가)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_orders_all"
    ON public.orders FOR ALL TO service_role
    USING (true) WITH CHECK (true);
```

> ⚠️ **알려진 이슈**: 웹훅 취소/환불 처리를 위한 `cancelled_at TIMESTAMPTZ`, `cancellation_reason TEXT` 컬럼이 현재 스키마에 없다. 새 프로젝트에서는 처음부터 추가 권장.

### 2.5 payment_events (멱등성 원장)

**원본**: `supabase/migrations/016_payment_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS public.payment_events (
    id         TEXT PRIMARY KEY,  -- paymentKey 또는 복합 eventKey
    event_type TEXT NOT NULL,     -- e.g. 'complete.consumable', 'webhook.CANCELED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: service_role만 접근
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_payment_events_all"
    ON public.payment_events FOR ALL TO service_role
    USING (true) WITH CHECK (true);
```

**멱등성 키 공간 설계**:
- 결제 완료: `id = paymentKey`, `event_type = 'complete.consumable'`
- 웹훅 이벤트: `id = '${paymentKey}::webhook.CANCELED'` (복합키로 키 공간 분리)

---

## 3. 공용 API 파이프라인

### 3.1 Supabase 클라이언트 2종

**원본**: `src/lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// RLS 적용 — 사용자 데이터 읽기, 인증 확인용
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* Server Component에서 호출 시 무시 */ }
        },
      },
    }
  );
}

// RLS 우회 — 토큰 조작, 주문 기록, 결제 이벤트 기록 전용
export async function createServiceClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { /* createClient와 동일 패턴 */ } }
  );
}
```

### 3.2 인증 헬퍼

**원본**: `src/lib/api-utils.ts`

```typescript
// discriminated union — auth.error가 있으면 user는 없음
export interface AuthResult { user: { id: string; user_metadata: Record<string, unknown> }; error?: never; }
export interface AuthError  { user?: never; error: NextResponse; }

export async function getAuthenticatedUser(): Promise<AuthResult | AuthError> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  return { user: user as AuthResult['user'] };
}

// 에러 응답: { success: false, error: "<string>", details?, code? }
// production에서 details 자동 제거 (정보 노출 방지)
export function errorResponse(message: string, status: number, details?: string, code?: string): NextResponse {
  return NextResponse.json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && details && { details }),
    ...(code && { code }),
  }, { status });
}

// 성공 응답: { success: true, data: T }
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}
```

> ⚠️ `errorResponse`의 `error` 필드는 **string** (메시지 직접 포함). `types/api.ts`의 `API_ERROR_CODES` enum (`IApiError {code, message}`)은 의도된 계약이지만 실제 토큰/결제 라우트는 이 형식을 사용하지 않는다. 새 프로젝트에서는 처음부터 형식 통일 권장.

### 3.3 CSRF 보호

**원본**: `src/lib/security/csrf.ts`, `src/lib/security/csrf-middleware.ts`, `src/lib/api/csrf-fetch.ts`

**작동 방식**: Double-Submit Cookie + HMAC-SHA256 서명

```typescript
// 환경변수: CSRF_SECRET (32자 이상 랜덤, production에서 필수)
// 쿠키: _csrf (plaintext token), _csrf_sig (HMAC-SHA256 서명)
// 헤더: x-csrf-token (클라이언트가 주입)

export const CSRF_HEADER_NAME           = 'x-csrf-token';
export const CSRF_COOKIE_NAME           = '_csrf';
export const CSRF_SIGNATURE_COOKIE_NAME = '_csrf_sig';
```

**서버 — 토큰 발급**: `GET /api/csrf` 라우트에서 `generateCsrfToken()` + `signToken()` → `_csrf`, `_csrf_sig` 쿠키 설정, `{ token }` 응답

**서버 — 검증**:
```typescript
import { validateCsrfToken } from '@/lib/security/csrf-middleware';

// 모든 POST/PUT/DELETE 라우트 최상단에서 호출
const csrfCheck = await validateCsrfToken(request);
if (!csrfCheck.valid && csrfCheck.response) return csrfCheck.response; // 403
// 검증 흐름: 헤더 x-csrf-token 확인 → 쿠키 _csrf와 일치 → _csrf_sig HMAC 서명 검증
```

**클라이언트 — 자동 주입**:
```typescript
import { csrfPost } from '@/lib/api/csrf-fetch';

// GET /api/csrf에서 토큰을 인메모리 캐시, x-csrf-token 헤더 자동 삽입
// 403 응답 시 캐시 자동 초기화
const res = await csrfPost('/api/tokens/spend', { amount, feature, reference_id });
```

### 3.4 Rate Limiting

**원본**: `src/lib/rate-limit.ts`

> **Supabase `rate_limits` 테이블 기반** (Redis/Upstash 아님). Sliding Window Counter 방식.

```typescript
export const RATE_LIMITS = {
  IAP_VERIFY:       { limit: 10, windowSeconds: 3600, keyPrefix: 'iap:verify' },
  PAYMENT_COMPLETE: { limit: 10, windowSeconds: 3600, keyPrefix: 'payment:complete' },
  AUTH_REGISTER:    { limit: 3,  windowSeconds: 60,   keyPrefix: 'auth:register', failClosed: true },
  // ... 기타 엔드포인트
} as const;

// 사용 패턴
const rateLimitResult = await withRateLimit(RATE_LIMITS.IAP_VERIFY, request);
if (!rateLimitResult.success) return rateLimitExceededResponse(rateLimitResult); // 429
```

- `failClosed: true` — DB 오류 시 요청 거부 (인증 엔드포인트 권장)
- `failClosed: false` (기본) — DB 오류 시 요청 허용 (가용성 우선)

> ⚠️ `PAYMENT_COMPLETE` 설정이 정의되어 있지만 실제 `payments/complete` 라우트에 `withRateLimit` 호출이 없다. 새 프로젝트에서는 결제 완료 라우트에도 rate limit 실제 적용 권장.

### 3.5 표준 라우트 스켈레톤

#### 타입 1 — 일반 변경 라우트 (`tokens/spend` 패턴, CSRF+Auth)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, errorResponse } from '@/lib/api-utils';
import { createServiceClient } from '@/lib/supabase/server';
import { validateCsrfToken } from '@/lib/security/csrf-middleware';

export async function POST(request: NextRequest) {
  // 1. CSRF
  const csrfCheck = await validateCsrfToken(request);
  if (!csrfCheck.valid && csrfCheck.response) return csrfCheck.response;

  // 2. Auth
  const auth = await getAuthenticatedUser();
  if (auth.error) return auth.error;
  const userId = auth.user.id;

  // 3. Parse body
  let body: { amount?: number; feature?: string; reference_id?: string };
  try { body = await request.json(); }
  catch { return errorResponse('Invalid request format', 400); }

  // 4. Validate
  if (!body.amount || body.amount <= 0) return errorResponse('Invalid amount', 400);
  if (!body.feature) return errorResponse('Feature name is required', 400);

  // 5. Business logic (token ops always use service client)
  const supabase = await createServiceClient();
  const { error } = await supabase.rpc('adjust_tokens', {
    p_user_id: userId,
    p_amount: -body.amount,
    p_type: 'spend_feature',
    p_description: `${body.feature} 이용`,
    p_reference_id: body.reference_id ?? null,
  });
  if (error) return errorResponse('Token operation failed', 500);

  return NextResponse.json({ success: true, data: { remaining: 0 } });
}
```

#### 타입 2 — 금융 풀 파이프라인 (`iap/verify` 패턴, Rate Limit 포함)

```typescript
export async function POST(request: NextRequest) {
  // 1. Rate Limit (재무 op)
  const rateLimitResult = await withRateLimit(RATE_LIMITS.IAP_VERIFY, request);
  if (!rateLimitResult.success) return rateLimitExceededResponse(rateLimitResult);

  // 2. CSRF
  const csrfCheck = await validateCsrfToken(request);
  if (!csrfCheck.valid && csrfCheck.response) return csrfCheck.response;

  // 3. Auth
  const auth = await getAuthenticatedUser();
  if (auth.error) return auth.error;

  // 4~5: parse → validate → business logic...
}
```

---

## 4. Rail 1 — 토큰 구매 (결제/IAP)

### 4.1 상품 카탈로그 (서버 신뢰 가격 원천)

**원본**: `src/lib/payments/toss.ts`

```typescript
export interface TossProduct {
  productId: string;
  type: 'subscription' | 'consumable';
  tokensGranted: number;
  label: string;
  amount: number;    // KRW 단위
  currency: 'KRW';
}

export const TOSS_PRODUCTS: Record<string, TossProduct> = {
  tokens_10:  { productId: 'tokens_10',  type: 'consumable', tokensGranted: 10,  label: '10 토큰 (₩1,000)',  amount: 1000,  currency: 'KRW' },
  tokens_50:  { productId: 'tokens_50',  type: 'consumable', tokensGranted: 55,  label: '55 토큰 (₩4,500)',  amount: 4500,  currency: 'KRW' },
  tokens_100: { productId: 'tokens_100', type: 'consumable', tokensGranted: 120, label: '120 토큰 (₩8,000)', amount: 8000,  currency: 'KRW' },
};
```

> **서버에서만 가격 신뢰**: 클라이언트가 보낸 `productId`로 서버에서 `TOSS_PRODUCTS[productId].amount`를 조회하여 Toss confirm API에 전달. 클라이언트 금액은 절대 신뢰 금지.

### 4.2 웹 결제 흐름 (TossPayments V2 위젯)

```
[클라이언트]
purchase CTA → router.push(`/payments/charge`)

payments/charge:
  POST /api/payments/init 로 서버가 orderId/customerKey/amount/token_amount 저장
  widgets.setAmount({ currency: 'KRW', value: product.amount })
  widgets.requestPayment({ orderId, orderName, successUrl, failUrl })
    └─ Toss 인증 완료 → redirect to complete?paymentKey=...&orderId=...

complete/page.tsx:
  csrfPost('/api/payments/complete', { paymentKey, orderId, productId })
  fetchStatus(true)  // force 갱신
```

클라이언트 위젯 초기화 (`src/hooks/use-toss-widgets.ts`):
```typescript
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';

const tossPayments = await loadTossPayments(clientKeyFromOrderApi);
const widgets = tossPayments.widgets({ customerKey: userId });
await widgets.setAmount({ currency: 'KRW', value: product.amount });
await widgets.renderPaymentMethods({ selector: '#payment-widget', variantKey: 'DEFAULT' });
await widgets.renderAgreement({ selector: '#agreement' });
await widgets.requestPayment({ orderId, orderName, successUrl, failUrl });
```

### 4.3 서버 결제 완료 라우트

**원본**: `src/app/api/payments/complete/route.ts`

```
POST /api/payments/complete
  1. validateCsrfToken()                                          → 403
  2. getAuthenticatedUser()                                       → 401
  3. body = { paymentKey, orderId, productId } 수동 parse
  4. TOSS_PRODUCTS[productId] 확인                                → 400
  5. confirmPayment(paymentKey, orderId, product.amount)          → 400
  6. payment.status !== 'DONE'                                    → 400
  7. payment.totalAmount !== product.amount (금액 위변조 방지)    → 400
  8. createServiceClient()
  9. payment_events idempotency 체크 (id = paymentKey)
     → 이미 존재: { status: 'already_processed', productId }
  10. orders INSERT (portone_payment_id = paymentKey)
  11. consumable: adjust_tokens(+tokensGranted, 'purchase', paymentKey)
      subscription: subscriptions UPSERT + adjust_tokens(+bonus, 'subscription_bonus', paymentKey)
  12. payment_events INSERT (id = paymentKey, event_type = 'complete.consumable')
  13. { status: 'tokens_granted', productId, tokensGranted }
```

핵심 코드 발췌:

```typescript
// idempotency 체크
const { data: existingEvent } = await supabase
  .from('payment_events').select('id').eq('id', paymentKey).maybeSingle();
if (existingEvent) {
  return NextResponse.json({ success: true, data: { status: 'already_processed', productId } });
}

// 토큰 지급 (consumable)
const { error } = await supabase.rpc('adjust_tokens', {
  p_user_id: userId,
  p_amount: product.tokensGranted,
  p_type: 'purchase',
  p_description: `${product.label} 구매`,
  p_reference_id: paymentKey,
});
if (error) return errorResponse('토큰 지급에 실패했습니다', 500);

// idempotency 기록 (토큰 지급 이후 마지막에)
await supabase.from('payment_events').insert({
  id: paymentKey,
  event_type: `complete.${product.type}`,  // 'complete.consumable'
});
```

### 4.4 서버 확인 유틸리티

**원본**: `src/lib/payments/toss-server.ts`

```typescript
// Auth 헤더: Basic base64("${TOSS_SECRET_KEY}:")
export async function confirmPayment(
  paymentKey: string, orderId: string, amount: number
): Promise<{ success: true; data: TossPaymentConfirmResponse } | { success: false; error: TossPaymentError }> {
  const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`, 'utf-8').toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  // error.code: 'CONFIG_ERROR' (환경변수 없음) | 'NETWORK_ERROR' | Toss 오류 코드
}

// 웹훅/관리자 확인용 단건 조회
export async function getPayment(paymentKey: string): Promise<TossPaymentConfirmResponse | null>
```

### 4.5 네이티브 IAP

**원본**: `src/app/api/iap/verify/route.ts`, `src/lib/iap/purchase.ts`

```
POST /api/iap/verify
  1. withRateLimit(RATE_LIMITS.IAP_VERIFY, request)          → 429
  2. validateCsrfToken()                                     → 403
  3. getAuthenticatedUser()                                  → 401
  4. { platform, receipt, productId, transactionId } 검증
  5. platform === 'android': verifyGoogleProduct()
     platform === 'ios': Apple JWS 검증
  6. adjust_tokens(+tokensGranted, 'purchase', transactionId)
```

Capacitor + `cordova-plugin-purchase` 사용. **웹 환경에서는 IAP 미사용 → TossPayments checkout으로 라우팅**.

### 4.6 웹훅 (취소/환불)

**원본**: `src/app/api/webhooks/toss/route.ts`

```
POST /api/webhooks/toss
  1. 일반 결제 webhook은 HMAC secret 없이 paymentKey로 Toss 재조회 (진실원천 확인)
  2. eventKey = `${paymentKey}::webhook.${status}` (복합 멱등키)
  3. payment_events에 eventKey 존재 → 스킵
  4. status === 'CANCELED':
       orders UPDATE status='cancelled'
       음수 adjust_tokens(-tokensGranted, 'purchase', ...) — 토큰 회수
  5. payment_events INSERT (id = eventKey)
```

> TossPayments V2 일반 결제 webhook은 `tosspayments-webhook-signature` HMAC 검증 대상이 아니다. 환불·취소 자동화를 켜는 경우에도 webhook payload를 그대로 신뢰하지 않고 `paymentKey`로 Toss 결제 조회 API를 다시 호출한다.

### 4.7 구매 직후 클라 잔액 갱신

```typescript
// 구매 완료 직후 반드시 force=true로 5분 stale 캐시 우회
const { fetchStatus } = useSubscriptionStore.getState();
await fetchStatus(true);
```

---

## 5. Rail 2 — 토큰 차감 (기능 과금)

### 5.1 서버 라우트

**원본**: `src/app/api/tokens/spend/route.ts`

```
POST /api/tokens/spend
  Body: { amount: number, feature: string, reference_id?: string }

  1. validateCsrfToken()                                  → 403
  2. getAuthenticatedUser()                               → 401
  3. { amount, feature } 수동 검증 (amount > 0 필수)
  4. createServiceClient()
  5. reference_id 있으면: KST 자정 이후 중복 차감 확인
     → 이미 있으면: { remaining: balance, alreadySpentToday: true }  (무과금 통과)
  6. user_tokens.balance 조회
  7. balance < amount                                     → 402
  8. adjust_tokens(-amount, 'spend_feature', reference_id)
  9. { remaining: balance - amount, alreadySpentToday: false }
```

KST 자정 계산 패턴:
```typescript
const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
const todayStartKST = new Date(kstNow);
todayStartKST.setHours(0, 0, 0, 0);
// KST 자정을 UTC로 변환
const todayStartUTC = new Date(todayStartKST.getTime() - 9 * 60 * 60 * 1000);

const { count } = await supabase
  .from('token_transactions')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('reference_id', reference_id)
  .gte('created_at', todayStartUTC.toISOString());

if ((count ?? 0) > 0) {
  // 오늘 이미 차감됨 — 무과금으로 통과
  return NextResponse.json({ success: true, data: { remaining: balance, alreadySpentToday: true } });
}
```

### 5.2 reference_id 멱등키 설계

```
형식: {feature}_{KSTDate}_{고유식별자}

예시:
  궁합 (1일 1과금):    'compatibility_2026-05-21_partnerBirthKey'
  삼각궁합 (1일 1과금): 'triangle_compat_2026-05-21_partner1_partner2'
  차트 탭 (탭별 1일):   'chart_tab_saju_2026-05-21'
```

> ⚠️ **현재 3eyes 구현**: 비용 상수가 클라이언트 페이지마다 하드코딩(`COMPATIBILITY_TOKEN_COST = 1`). 서버는 클라이언트 `amount`를 신뢰. **새 프로젝트 개선 권장**:
> ```typescript
> // 서버측 중앙 cost 맵 (클라이언트 amount 무시)
> const FEATURE_COSTS: Record<string, number> = {
>   compatibility: 1, triangle_compatibility: 1, chart_tab_saju: 1,
> };
> const amount = FEATURE_COSTS[feature];
> if (!amount) return errorResponse('Unknown feature', 400);
> ```

### 5.3 클라이언트 훅

**원본**: `src/hooks/use-tokens.ts`

```typescript
const { spendTokens } = useTokens();

// feature: 서버 FEATURE_LABELS의 키, referenceId: 멱등키
const success = await spendTokens(1, 'compatibility', `compatibility_${kstDate}_${partnerKey}`);
// 내부 동작:
//   csrfPost('/api/tokens/spend', { amount, feature, reference_id })
//   alreadySpentToday가 false일 때만: addLocalTokens(-amount) + showToast(amount)
```

---

## 6. Rail 3 — 토큰 적립 (광고·보너스)

### 6.1 일일 로그인 보너스

**원본**: `src/app/api/rewards/session/route.ts`, `supabase/migrations/20260525090000_free_talisman_rewards.sql`

```typescript
// POST /api/rewards/session
// 1. Supabase session user 확인
// 2. award_free_talisman_session_rewards(uid, auth_created_at, policy_effective_at)
// 3. public.users 프로필이 없으면 PROFILE_REQUIRED 반환
// 4. KST 오늘 'daily_login:<YYYY-MM-DD>' reference 확인
// 5. 없으면 token_ledger reason='bonus', delta=+1 기록
```

### 6.2 보상형 광고

**원본**: `src/app/api/ads/reward-verify/route.ts`

```typescript
const MAX_DAILY_REWARD_ADS      = 10; // 일일 한도 (429)
const TOKENS_PER_REWARD_AD      = 1;
const MIN_REWARD_INTERVAL_SECONDS = 30; // 최소 간격 (429)

// POST /api/ads/reward-verify
// 1. validateCsrfToken() → getAuthenticatedUser()
// 2. KST 오늘 'reward_ad' count >= 10              → 429
// 3. 마지막 reward_ad 이후 30초 미경과              → 429
// 4. adjust_tokens(+1, 'reward_ad', null)
// 5. { tokensGranted: 1, dailyRemaining: N }
```

> ⚠️ **신뢰-클라이언트 방식 (SSV 미구현)**: 클라이언트가 광고 완료를 보고하면 서버가 신뢰. 어뷰징 방지가 중요하면 [AdMob Server-Side Verification](https://developers.google.com/admob/android/ssv) 추가 권장.

### 6.3 가입 보너스

**원본**: `src/app/api/rewards/session/route.ts`, `src/components/rewards/free-talisman-reward-gate.tsx`

```typescript
// 회원가입 보상:
//   Auth 가입 직후가 아니라 온보딩 완료로 public.users가 생성된 뒤 지급한다.
//   p_auth_created_at >= 2026-05-25T00:00:00+09:00 이고
//   'signup:<userId>' reference가 없으면 reason='bonus', delta=+5 기록.
//   기존 가입자에게는 소급 지급하지 않는다.
//   가입 당일 daily_login +1과 signup +5는 둘 다 받을 수 있다.
```

### 6.4 이력 조회

**원본**: `src/app/api/tokens/history/route.ts`

```typescript
// GET /api/tokens/history?type=&limit=&offset=
// createClient() 사용 (RLS 적용 — service client 아님)
// limit 최대 100, 기본 20
// Response: { success: true, data: { transactions: TokenTransaction[] } }
```

### 6.5 관리자 수동 지급

**원본**: `src/app/api/admin/tokens/grant/route.ts`

```typescript
// POST /api/admin/tokens/grant
// Header: x-admin-secret: ${ADMIN_SECRET_KEY}  (crypto.timingSafeEqual 검증)
// Body: { userId: string, amount: number, description: string }
// type: 'purchase' 재사용, referenceId: `admin_grant_${Date.now()}`
```

---

## 7. 클라이언트 상태 관리 (Zustand)

### 7.1 Store 역할 분리

| Store / Hook | 역할 | 핵심 상태 |
|-------------|------|----------|
| `subscription-store` | **토큰 잔액 소유자** | `tokenBalance`, `totalEarned`, `totalSpent`, `tier`, `remainingTurns` |
| `useTokens` hook | 이력 조회 + 차감 액션 | `history` (로컬), `spendTokens()` |
| `token-toast-store` | 차감 토스트 알림 | `isVisible`, `amount`, `showToast()` |
| `user-store` | 인증 상태 | `user`, `isAuthenticated` (잔액 없음) |

### 7.2 subscription-store 핵심

**원본**: `src/stores/subscription-store.ts`

```typescript
// localStorage key: '3eyes-subscription-storage'
// 5분 stale 캐시 (구매 직후는 force=true로 우회)
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      tokenBalance: 0,
      totalEarned: 0,
      totalSpent: 0,
      tier: 'free' as 'free' | 'token' | 'premium',
      remainingTurns: 3,

      fetchStatus: async (force?: boolean) => {
        // force=false이고 5분 이내 갱신 시 스킵
        if (!force && get().lastFetchedAt && Date.now() - get().lastFetchedAt! < STALE_THRESHOLD_MS) return;
        const res = await fetch('/api/subscription/status');
        const { tokens, turnLimit } = (await res.json()).data;
        set({
          tokenBalance: tokens?.balance ?? 0,
          totalEarned: tokens?.total_earned ?? 0,
          tier: turnLimit?.tier ?? 'free',
          lastFetchedAt: Date.now(),
        });
      },

      // 낙관적 차감 (UI 즉시 반영)
      addLocalTokens: (amount) => set((s) => ({
        tokenBalance: s.tokenBalance + amount,
        totalEarned: s.totalEarned + amount,
      })),

      reset: () => set(initialState),
    }),
    {
      name: '3eyes-subscription-storage',
      storage: createJSONStorage(() => localStorage),
      // persist 대상 (서버 재조회 없이 유지할 항목만)
      partialize: (state) => ({
        subscriptionStatus: state.subscriptionStatus,
        tokenBalance: state.tokenBalance,
        tier: state.tier,
        remainingTurns: state.remainingTurns,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
);

// 셀렉터 (최적화된 리렌더)
export const useTokenBalance = () => useSubscriptionStore((s) => s.tokenBalance);
export const useTier         = () => useSubscriptionStore((s) => s.tier);
export const useIsPremium    = () => useSubscriptionStore((s) => s.subscriptionStatus === 'active');
```

> ⚠️ **계정 전환 시 `reset()` 필수**: persist middleware가 이전 계정 데이터를 localStorage에 유지한다. 로그아웃/계정 전환 시 반드시 `useSubscriptionStore.getState().reset()` 호출.

### 7.3 useTokens 훅

**원본**: `src/hooks/use-tokens.ts`

```typescript
function useTokens() {
  const balance = useTokenBalance();  // subscription-store에서 읽음
  const { addLocalTokens } = useSubscriptionStore.getState();
  const showToast = useTokenToastStore((s) => s.showToast);

  const spendTokens = async (amount: number, feature: string, referenceId?: string): Promise<boolean> => {
    const res = await csrfPost('/api/tokens/spend', { amount, feature, reference_id: referenceId });
    if (!res.ok) return false;
    const { alreadySpentToday } = (await res.json()).data;
    if (!alreadySpentToday) {
      addLocalTokens(-amount);  // 낙관적 차감
      showToast(amount);        // 차감 토스트 표시
    }
    return true;
  };

  return { balance, spendTokens, fetchHistory, /* ... */ };
}
```

---

## 8. 무료 부적 쓰기 리추얼 UX 패턴 (engagement, 비결제)

> 서버·결제 없음. localStorage만 사용하는 일일 완료 상태머신. "일일 keyed 완료 기능"을 구현할 때 재사용 가능한 패턴.

### 8.1 상태 훅

**원본**: `src/hooks/use-amulet-state.ts`

```typescript
const STORAGE_KEY_PREFIX = '3eyes-amulet-completed';

export interface AmuletState {
  isCompleted: boolean;
  completedAt: string | null;
  duration: number | null;   // 완료까지 걸린 ms
  dayMaster: string | null;  // 작성한 한자 (예: '甲')
}

// 스토리지 키 형식 (로컬 타임존 = KST 기준 자정 리셋)
// `3eyes-amulet-completed_${userId}_${YYYY-MM-DD}`
//
// userId 파생:
//   로그인: `${user.id}_${birth_date}_${birth_time}_${gender}` (프로필별 구분)
//   게스트: `guest_${birth_date}_${birth_time}_${gender}`
//
// 7일 이전 키 자동 삭제 (useEffect cleanup)

function useAmuletState(): {
  state: AmuletState;
  isLoading: boolean;
  setCompleted: (duration: number, dayMaster: string) => void;
  reset: () => void;
}
```

### 8.2 3-state CTA 도출 패턴 (부모 컴포넌트)

**원본**: `src/components/features/daily-insight-v2/daily-insight-v2.tsx:118-134`

```typescript
const { state: amuletState, isLoading: amuletLoading, setCompleted } = useAmuletState();

// 오늘의 천간 데이터 추출 (없으면 CTA 노출 안 함)
const heavenlyStemInfo = data.todayGanji?.day
  ? extractHeavenlyStem(data.todayGanji.day)
  : null;
if (!heavenlyStemInfo) return null;  // 게이팅

// 3-state CTA
const ctaState: 'loading' | 'completed' | 'default' =
  amuletLoading ? 'loading' :
  (amuletState.isCompleted && amuletState.dayMaster === heavenlyStemInfo.hanja) ? 'completed' :
  'default';
```

### 8.3 모달 패턴

**원본**: `src/components/features/amulet/amulet-modal.tsx`

```typescript
interface AmuletModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: string;           // 한자 (예: '甲')
  characterKorean?: string;
  onComplete: (duration: number) => void;  // 부모에 완료 보고
}

// ModalState: 'drawing' | 'success'
// hanzi-writer: dynamic import (SSR 방지)
// onComplete 콜백으로 부모에서 setCompleted(duration, character) 호출
```

### 8.4 결제 연동 graft 포인트

```typescript
// 현재: onComplete는 setCompleted()만 호출 (서버 없음)
// 결제 연동 시: onComplete에 토큰 적립 로직 추가

const handleAmuletComplete = async (duration: number) => {
  setCompleted(duration, character);
  // graft 포인트: 토큰 보상 추가 가능
  // await csrfPost('/api/tokens/reward-ritual', { duration });
  // await fetchStatus(true);
};
```

### 8.5 분석 이벤트 (`src/lib/analytics.ts`)

```typescript
trackEvent('amulet_cta_click');
trackEvent('amulet_modal_open');
trackEvent('amulet_free_draw_complete', { duration });
trackEvent('amulet_modal_close');
```

---

## 9. (부록 A) 법적·컴플라이언스 고려 — 한국 디지털 재화 판매

> **선택 적용**: 운세·심리·엔터테인먼트 도메인 기준. 다른 도메인은 해당 항목만 선택 적용.
> 원본 참조: `app/[locale]/terms/terms-content.tsx`, `docs/TERMSOFSERVICE.md`

| 항목 | 규정 |
|------|------|
| **1회 충전 한도** | ≤ ₩100,000 (전자상거래법) |
| **유상 토큰 유효기간** | 1년 (또는 서비스 종료 시) |
| **무상 토큰 환불** | 환불 불가, 유효기간 명시 필수 |
| **청약철회** | 구매 후 7일 이내 (단, 즉시 소비된 디지털 콘텐츠 예외 + **사전 고지 필수**) |
| **미성년자 보호** | 법정대리인 동의 없는 결제 취소 가능 |
| **면책조항 (운세 도메인)** | 모든 운세·코칭 응답에 "오락·자기발견 목적, 법적 조언 아님" 명시 필수 |

즉시 소비 예외를 적용하려면 결제 시작 전 동의 화면에 "구매 즉시 소비되어 청약철회 불가" 사전 고지가 필요하다.

---

## 10. (부록 B) 구현 체크리스트 & 적용 순서

### 10.1 단계별 적용 순서

```
① DB 스키마/RPC
   - 001 (auth.users, update_updated_at_column 트리거) 선행 확인
   - 012 (user_tokens, token_transactions, adjust_tokens) 적용
   - 016 (orders, payment_events) 적용
   - 011 (rate_limits) 적용 [rate limiting 사용 시]

② 공용 파이프라인
   - src/lib/supabase/server.ts       (createClient, createServiceClient)
   - src/lib/api-utils.ts             (getAuthenticatedUser, errorResponse, successResponse)
   - src/lib/security/csrf.ts         (generateCsrfToken, signToken, verifyCsrfToken)
   - src/lib/security/csrf-middleware.ts (validateCsrfToken)
   - src/app/api/csrf/route.ts        (GET — 토큰 발급 엔드포인트)
   - src/lib/api/csrf-fetch.ts        (csrfPost, csrfPut, csrfDelete)
   - src/lib/rate-limit.ts            (checkRateLimit, withRateLimit, RATE_LIMITS)

③ Rail 1 — 토큰 구매
   - src/lib/payments/toss.ts         (TOSS_PRODUCTS 상품 카탈로그)
   - src/lib/payments/toss-server.ts  (confirmPayment, getPayment)
   - src/app/api/payments/complete/route.ts
   - src/app/api/iap/verify/route.ts  [네이티브 IAP]
   - src/app/api/webhooks/toss/route.ts [취소/환불]
   - 클라: checkout/page.tsx, complete/page.tsx, purchase-sheet.tsx

④ Rail 2 — 토큰 차감
   - src/app/api/tokens/spend/route.ts
   - 클라: useTokens.spendTokens() → csrfPost + addLocalTokens

⑤ Rail 3 — 토큰 적립
   - src/app/api/rewards/session/route.ts
   - src/components/rewards/free-talisman-reward-gate.tsx
   - src/app/api/ads/reward-verify/route.ts
   - 가입 보너스: 온보딩 완료 후 session reward RPC가 bonus +5 멱등 지급
   - src/app/api/tokens/history/route.ts
   - src/app/api/admin/tokens/grant/route.ts [선택]

⑥ 클라이언트 상태
   - src/stores/subscription-store.ts (fetchStatus, addLocalTokens)
   - src/hooks/use-tokens.ts          (spendTokens, fetchHistory)
   - src/stores/token-toast-store.ts  (차감 토스트)

⑦ 무료 리추얼 UX [선택]
   - src/hooks/use-amulet-state.ts
   - src/components/features/amulet/*
```

### 10.2 환경변수 전체 목록

| 변수 | 예시 | 필수 여부 |
|------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | ✅ |
| `TOSS_CLIENT_KEY` | `test_ck_...` | ✅ (웹 결제) |
| `TOSS_SECRET_KEY` | `test_sk_...` | ✅ (웹 결제) |
| `CSRF_SECRET` | `<32자 이상 랜덤>` | ✅ |
| `ADMIN_SECRET_KEY` | `<랜덤>` | 선택 (관리자 API) |

무료 부적 지급 수량은 env가 아니라 DB RPC 정책값이다: 일일 인증 앱 진입 `+1`, 신규 온보딩 완료 가입 `+5`, 서버가 성공을 검증할 수 있는 Kakao webhook 공유 `+1`.

### 10.3 3eyes 대비 개선 권장사항

새 프로젝트에서 더 잘 구현할 수 있는 항목:

| 항목 | 3eyes 현황 | 권장 개선 |
|------|-----------|----------|
| 결제 payload 검증 | 수동 if 체크 | Zod 스키마 도입 |
| 기능별 토큰 비용 | 클라 하드코딩, 서버 신뢰 | 서버측 `FEATURE_COSTS` 중앙 맵 |
| 광고 보상 검증 | 신뢰-클라이언트 | AdMob SSV 구현 |
| 결제 완료 Rate Limit | 설정 있지만 미적용 | `withRateLimit(PAYMENT_COMPLETE)` 실제 적용 |
| 결제 주문 스키마 | 취소/환불 컬럼 없음 | `cancelled_at`, `cancellation_reason` 처음부터 추가 |
| 에러 응답 형식 | `error: string` vs `{code, message}` 혼용 | `IApiError {code, message}` 형식으로 통일 |
| Webhook 보안 | 일반 결제 HMAC 없음, getPayment 재조회로 검증 | 최신 Toss V2 기준 유지. payload 단독 신뢰 금지 |
| API 파이프라인 순서 | 코드와 문서 불일치 | 실제 코드 기준 (CSRF→Auth) 문서 통일 |

---

*3eyes 원본: `src/` 및 `supabase/migrations/`. 스키마·RPC 변경 시 해당 파일 직접 확인.*
