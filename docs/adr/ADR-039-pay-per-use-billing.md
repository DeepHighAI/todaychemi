# ADR-039: Pay-Per-Use Feature Billing — 부적 충전 폐지 → 사용 시 즉시 결제

**Date:** 2026-06-03
**Status:** Accepted (비협상 — 변경 시 CLAUDE.md §1.1 승인 필수)
**Deciders:** batisututu
**Amended:** 2026-06-07 — 가격 800/500/400 → **1,000/800/600원**, 부적 차감 8/5/4 → **10/8/6p** (§1.1 D6 확정. 사유: 앱인토스 인앱결제 수수료 약 20% 반영 + 웹·미니앱 가격 통일. 1부적=100원 등가 유지)
**Amended:** 2026-06-10 — **인연 등록 슬롯 과금 추가(모델 B)**: 인연 2명까지 무료 등록, 3번째부터 `relation_slot` 1,000원/10부적. 기존 기능별 과금 유지·병행 (§1.1 승인, 본 문서 §9)

## Context

기존 모델은 부적(토큰) 번들을 미리 충전한 뒤 유료 기능 사용 시 부적을 차감했다. 충전
UX 마찰(별도 충전 화면·번들 선택), 미사용 잔액 누적, 결제 흐름 복잡도가 문제였다.

유료 기능은 **케미카드(hapcard)·만약에 우리(whatif)·케미 다시 맞추기(replay)** 3종이다. 이들을 사용
시점에 즉시 결제하는 모델로 전환한다(`feature/pay-per-use-billing`, 2026-06-01 §1.1
설계 승인, `/plan-eng-review`).

핵심 제약: LLM 생성은 비용·지연이 크고, 결제 위젯은 클라이언트 리다이렉트(303)로 완료된다.
따라서 "언제 본문을 생성하고 언제 과금을 확정하는가"의 원자성 정책이 필요했다.

## Decision

### 1. 하이브리드 과금 (무료 부적 우선 → 부족 시 현금)
무료 부적 잔액이 충분하면 `token_ledger`에서 차감(케미카드 10p·만약에 우리 8p·케미 다시 맞추기 6p).
잔액 부족 시 **1회성 현금 결제**(웹: Toss Payment Widget V2 / 앱인토스 미니앱: 인앱결제 IAP — 2026-06-07 D3)로 전환한다. 구독·번들 없음.

### 2. 가격 단일 출처
케미카드 1,000원 / 만약에 우리 800원 / 케미 다시 맞추기 600원 / 인연 등록(3번째+) 1,000원
(2026-06-07·06-10 개정, 웹·미니앱 통일). 유일 출처는
`src/lib/payments/feature-prices.ts`의 `FEATURE_PRICES_KRW`(+`FREE_RELATION_SLOTS`).
DB·문서·클라이언트는 이 값을 참조하며 별도 상품 카탈로그 테이블을 두지 않는다.

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
`feature_ref` 포맷: 케미카드/만약에 우리 = `cache_key`, 케미 다시 맞추기 = `replay:{hapcard_id}:{jinjin_date}`,
인연 등록 = `relation_slot:{pending_id}`.

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
토큰 생성, nickname+점수)는 **본문이 아닌 점수·메타데이터만** 노출한다. 합점수는 이미 케미피드에서
무료로 보이므로 이 3경로는 게이트하지 않는다(본문 유출 아님). 게이트 범위는 본문 2경로(§5)로 한정.

### 9. 인연 등록 슬롯 과금 — 모델 B (Amended 2026-06-10)
인연 등록 자체에 두 번째 수익화 레이어를 추가한다. 기존 기능별 과금(§1~§8)은 그대로 유지.

- **게이트**: 등록 시점의 **현재 보유 행 수**(`count(relations where user_id)`)가
  `FREE_RELATION_SLOTS`(=2) 미만이면 무료, 이상이면 `relation_slot` 과금. 인연을 삭제하면
  슬롯이 회복된다(평생 누적 추적 없음). 기존 유저(이미 3명+ 보유)는 자연 grandfather —
  보유분은 그대로, 다음 등록부터 게이트 적용. 백필 없음.
- **하이브리드**: 무료 부적 10p 우선 차감 → 부족 시 현금 1,000원 (§1과 동일, 1부적=100원 등가).
- **원자성 = draft-stage 변형 (비-LLM 모델 C)**: 등록은 CREATE 액션인데 현금 결제는 비동기
  리다이렉트이므로, 검증된 draft 를 `pending_relation_registrations`(JSONB)에 **스테이징**한 뒤
  부적 경로는 즉시, 현금 경로는 confirm 직후 **머티리얼라이즈**(relations INSERT)한다.
  `relations` 테이블은 깨끗하게 유지 — feed/today 등 읽기 사이트 변경 0.
- **머티리얼라이즈 멱등(claim-first)**: 클레임 UPDATE 가 `materialized_at`+`relation_id`
  (클라이언트 uuid)를 원자 기록 → 승자만 pk 고정 INSERT. 클레임↔INSERT 사이 크래시는
  재진입 시 pk-멱등 재INSERT 로 복구. FK `on delete set null` 덕분에 `relation_id NULL` +
  `materialized_at 有` = "머티리얼라이즈 후 삭제(슬롯 소비 완료)"로 유일 해석 — 재생성 금지.
- **lazy recovery**: confirm 후 머티리얼라이즈가 실패한 고아(돈 받고 인연 미생성)는 다음
  유료 등록 시도(POST /api/relations ≥2 경로)에서 **confirmed 결제 row 기준**으로 먼저
  전달한다(재과금 방지). ledger 기준(`isFeatureUnlocked`)은 환불 후에도 true 라 부적합.
- **cash-gen 한도 미적용**: relation_slot 은 LLM 선생성 비용이 없어 §7 한도를 적용하지 않는다.
- **클라이언트**: mode 단계 402 → `FeaturePaySheet(feature='relation_slot', next='/feed')`.
  현금 confirm 은 전면 리다이렉트라 mode 페이지 `draft.reset()` 이 실행되지 않음 →
  `/feed?paid=relation_slot:*` 복귀 시 draft 리셋(프리필 재제출 이중결제 차단).

**수용 리스크(문서화)**: ① count 게이트 TOCTOU — 동시 제출 시 드물게 무료 1건 초과(하드 캡
없음, launch 후 트리거 검토, codex #5 계열). ② 무료경로 더블탭 = 2 pending·2 차감·2 인연
(진짜 2등록 — 클라이언트 버튼 비활성으로 방어). ③ **open 결제 row 누적은 무제한** —
`payments_feature_open_uidx` 는 `(user_id, feature_id, feature_ref)` 라 ref 가 다른 미결제
pending 마다 open row 가 쌓일 수 있다(머니 리스크 아님, row 비대). 미머티리얼라이즈 pending
cleanup cron + 유저당 캡은 비차단 후속. ④ 결제 confirmed 된 pending 은 영구 머티리얼라이즈
가능 — 삭제 후 재등록 시 "결제했던 인연이 다시 나타나는" UX 는 의도된 결과(돈 받은 건 반드시 제공).

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
- **#3** KST 자정 cash 고아 — 모델 C에서 자정 경계에 선생성/결제가 분리되면 미결제 선생성 row가 고아가 될 수 있음(케미 다시 맞추기 dated-ref). 본 ADR이 수용하는 모델 C 엣지로 문서화.
- **#5** cash-gen 한도 raceable — `checkCashGenLimit`가 트랜잭션 락 없이 카운트해 동시 요청 시 한도 초과 선생성 가능. backlog.
- (**#4** 임의 ref 결제·**#6** RPC error→pay_required·**#7** init 더블탭 500 은 Phase 5에서 수정 — `verify-feature-ref-ownership`·게이트 2중 판별·23505 pending 재사용.)

## Implementation

- `src/lib/payments/feature-prices.ts` — `FEATURE_PRICES_KRW` 단일 출처(1,000/800/600 · 10/8/6p).
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

**relation_slot (Amended 2026-06-10, §9):**
- `supabase/migrations/20260610000000_relation_slot_registration.sql` — `pending_relation_registrations` 테이블(owner RLS) + payments `feature_id` CHECK 에 `relation_slot` + token_ledger 멱등 인덱스/RPC IN-list 에 `relation_slot_use`/`relation_slot_refund`.
- `src/lib/relations/insert.ts` — `insertRelationAndComputeChart`(무료 경로·머티리얼라이즈 공유, pk 고정 INSERT 지원).
- `src/lib/relations/materialize.ts` — `materializeRelationSlot`(claim-first 멱등, 삭제 소비 판별, un-claim 보상).
- `src/app/api/relations/route.ts` — count 게이트 + lazy recovery + 스테이징 + 402/환불.
- `src/app/api/payments/feature/confirm/route.ts` — relation_slot confirm 직후 머티리얼라이즈(실패해도 fail 리다이렉트 금지) + `next=/feed` allowlist.
- `src/app/(app)/relations/new/mode/page.tsx` — 402 → FeaturePaySheet + 사전 가격 고지.
- `src/app/(app)/feed/page.tsx` — `?paid=relation_slot:*` draft 리셋.
