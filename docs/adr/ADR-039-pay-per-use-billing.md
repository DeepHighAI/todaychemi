# ADR-039: Pay-Per-Use Feature Billing — 부적 충전 폐지 → 사용 시 즉시 결제

**Date:** 2026-06-03
**Status:** Accepted (비협상 — 변경 시 CLAUDE.md §1.1 승인 필수)
**Deciders:** batisututu

## Context

기존 모델은 부적(토큰) 번들을 미리 충전한 뒤 유료 기능 사용 시 부적을 차감했다. 충전
UX 마찰(별도 충전 화면·번들 선택), 미사용 잔액 누적, 결제 흐름 복잡도가 문제였다.

유료 기능은 **합카드(hapcard)·만약합(whatif)·다시합(replay)** 3종이다. 이들을 사용
시점에 즉시 결제하는 모델로 전환한다(`feature/pay-per-use-billing`, 2026-06-01 §1.1
설계 승인, `/plan-eng-review`).

핵심 제약: LLM 생성은 비용·지연이 크고, 결제 위젯은 클라이언트 리다이렉트(303)로 완료된다.
따라서 "언제 본문을 생성하고 언제 과금을 확정하는가"의 원자성 정책이 필요했다.

## Decision

### 1. 하이브리드 과금 (무료 부적 우선 → 부족 시 현금)
무료 부적 잔액이 충분하면 `token_ledger`에서 차감(합카드 8p·만약합 5p·다시합 4p).
잔액 부족 시 **1회성 현금 결제**(Toss Payment Widget V2)로 전환한다. 구독·번들 없음.

### 2. 가격 단일 출처
합카드 800원 / 만약합 500원 / 다시합 400원. 유일 출처는
`src/lib/payments/feature-prices.ts`의 `FEATURE_PRICES_KRW`. DB·문서·클라이언트는 이 값을
참조하며 별도 상품 카탈로그 테이블을 두지 않는다.

### 3. 원자성 = 모델 C (선생성 → 성공 시 결제)
요청 시 본문을 **먼저 생성**(LLM 호출 + 결과 row INSERT)한 뒤, 무료 차감 불가하면
HTTP 402로 결제를 요구한다. 클라이언트는 결제 시트를 열고, confirm 후 동일 요청을 재호출하면
잠금이 해제되어 캐시된 본문을 반환한다. 빌드 실패 시 `charged` 플래그로 무료 차감을 환불한다
(`refund_tokens_once`).

### 4. 잠금 단일 진실 = `isFeatureUnlocked`
선생성된 본문을 반환해도 되는지는 `isFeatureUnlocked(service, userId, feature, ref)` 하나로
판정한다:
- **무료 경로** — `token_ledger`에 `reason='{feature}_use'`, `reference_id=ref` 차감 기록, 또는
- **현금 경로** — `payments`에 `charge_type='feature_use'`, `feature_id`/`feature_ref` 일치, `status='confirmed'` row.

별도 entitlement 테이블 없이 `token_ledger`·`payments`가 곧 잠금해제 레코드다.
`feature_ref` 포맷: 합카드/만약합 = `cache_key`, 다시합 = `replay:{hapcard_id}:{jinjin_date}`.

### 5. Read-path 게이트 (Phase 7)
본문을 반환하는 GET 라우트도 쓰기 경로와 동일하게 게이트를 통과해야 한다. 본문 섹션을
반환/재계산하는 `GET /api/hapcards/[id]/ohaeng-interpretation`·`.../role-analysis`는 hapcard
`cache_key`로 `isFeatureUnlocked`를 평가하고, 미해제 시 402를 반환한다(미결제 선생성 본문
직접 호출 유출 차단).

### 6. 현금 결제는 부적을 적립하지 않는다
`confirm_feature_payment` RPC는 결제 확정만 수행하며 `token_ledger.reason='purchase'` 적립을
만들지 않는다. 결제 = 해당 `feature_ref` 잠금 해제. 레거시 `confirm_token_purchase` RPC는 제거.

### 7. cash-gen 일일 한도 (선생성 abuse 방어)
미결제 선생성 누적을 하루 5건(`CASH_GEN_DAILY_LIMIT`, 기본 5)으로 제한해 LLM 비용 abuse를
막는다(`checkCashGenLimit` → 초과 시 429 `RATE_LIMITED`).

### 8. 수용된 메타데이터 노출 (Phase 7 §1.1, 2026-06-03)
`snapshots`(점수 타임라인)·`OG /api/og/hapcard/[id]`(점수+오행 이미지, auth 401)·`share`(공유
토큰 생성, nickname+점수)는 **본문이 아닌 점수·메타데이터만** 노출한다. 합점수는 이미 합피드에서
무료로 보이므로 이 3경로는 게이트하지 않는다(본문 유출 아님). 게이트 범위는 본문 2경로(§5)로 한정.

## Alternatives Considered

| Option | Description | Rejected Because |
|---|---|---|
| A: 토큰 충전 유지 | 부적 번들 선충전 유지 | 충전 UX 마찰·미사용 잔액·흐름 복잡도 |
| B: 구독 | 월정액 무제한 | MVP 단계 과도, 사용 빈도 낮은 사용자에 불리 |
| C-A/B: 결제 후 생성 | 결제 확정 후에만 LLM 생성 | 결제→생성 지연이 사용자에 노출, 위젯 리다이렉트와 생성 사이 상태관리 복잡 |
| **D: 선생성 후 결제 (모델 C, 채택)** | 본문 먼저 생성·보류 → 성공 시 결제 | 결제 후 즉시 본문 표시, 빌드 실패 시 과금 없음. 미결제 선생성 row는 잠금 게이트로 차단 |

## Consequences

**Positive:**
- 충전 화면·잔액 관리 제거 → 결제 흐름 단순화, 미사용 잔액 문제 소멸.
- 가격 단일 출처(`feature-prices.ts`)로 DB·문서·클라이언트 일관성.
- 잠금 단일 진실(`isFeatureUnlocked`)로 쓰기·읽기 경로 게이트 일원화.
- 결제는 부적을 적립하지 않으므로 환불·정산 모델이 단순(결제 = 1 기능 unlock).

**Negative / 알려진 한계 (codex challenge 2026-06-02, disposition free-token backlog):**
- **#1** 환불 후 무료 재잠금해제 — `token_ledger` 차감 기록이 환불로 0이 되어도 unlock 판정이 유지될 수 있음(free-token 경로). backlog.
- **#2** `deduct_tokens_once` 무락 동시성 overspend — pre-existing RPC 한계, 동시 요청 시 잔액 초과 차감 가능. backlog.
- **#3** KST 자정 cash 고아 — 모델 C에서 자정 경계에 선생성/결제가 분리되면 미결제 선생성 row가 고아가 될 수 있음(다시합 dated-ref). 본 ADR이 수용하는 모델 C 엣지로 문서화.
- **#5** cash-gen 한도 raceable — `checkCashGenLimit`가 트랜잭션 락 없이 카운트해 동시 요청 시 한도 초과 선생성 가능. backlog.
- (**#4** 임의 ref 결제·**#6** RPC error→pay_required·**#7** init 더블탭 500 은 Phase 5에서 수정 — `verify-feature-ref-ownership`·게이트 2중 판별·23505 pending 재사용.)

## Implementation

- `src/lib/payments/feature-prices.ts` — `FEATURE_PRICES_KRW` 단일 출처(800/500/400 · 8/5/4p).
- `src/lib/payments/feature-unlock.ts` — `isFeatureUnlocked` 잠금 단일 진실.
- `src/lib/payments/feature-gate.ts` — `resolveFeatureCharge`(free|unlocked|pay_required, charged). 게이트 2중 판별(P0001+INSUFFICIENT_TOKENS만 pay_required).
- `src/lib/payments/feature-complete.ts` — `confirmFeaturePaymentForUser`(토큰 적립 X·멱등).
- `src/lib/payments/feature-ref-ownership.ts` — `verifyFeatureRefOwnership`(per-feature 소유 검증, self-harm 방어).
- `src/lib/payments/cash-gen-limit.ts` — `checkCashGenLimit`(일일 5건).
- `src/app/api/payments/feature/init/route.ts` + `feature/confirm/route.ts` — pending 생성/재사용 + 303 redirect confirm.
- `src/app/api/hapcards/route.ts` · `whatif/[type]/route.ts` · `hapcards/[id]/replay/route.ts` — 3 유료 라우트 게이트 통합 + replay dated-ref 멱등.
- `src/app/api/hapcards/[id]/{ohaeng-interpretation,role-analysis}/route.ts` — Phase 7 read-path 게이트.
- `src/components/payments/feature-pay-sheet.tsx` — 기능 화면 내 결제 시트.
- `src/lib/errors/route-response.ts` — `paymentRequiredResponse`(402). 에러코드 `PAYMENT_REQUIRED`/`RATE_LIMITED`.
- `supabase/migrations/20260601000000_feature_pay_per_use.sql` — payments `charge_type`/`feature_id`/`feature_ref` + `payments_feature_use_shape` check + `payments_feature_open_uidx` partial-unique + `confirm_feature_payment` RPC + drop `confirm_token_purchase`.
- 제거(Phase 6): `products.ts`·`token-costs.ts`·`payments/charge/*`·`charge-sheet.tsx`·old `api/payments/{init,order,confirm}`·`confirm_token_purchase` RPC.
