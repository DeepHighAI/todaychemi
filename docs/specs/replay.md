# Replay (다시합) Spec

> **Status: LOCKED — 2026-05-06 사용자 결정 완료**
>
> D1~D4 모두 확정. 구현 진행 중 (S-07b TDD).

---

## 1. 배경

`hapcard_replays` 테이블(`supabase/migrations/0007_hapcard_replays.sql`)과 `fluttering-gathering-island.md §4.3`(관계 진화 타임라인 재해석, Phase 1.5)에 근거한 기능.

원본 합카드(8p)와 동일한 `(user, relation, mode)` 조합을 *다른 시간 변수*(일진/주운/월운)로 재해석. 결과는 `hapcard_replays` INSERT.

---

## 2. §1.1 결정 매트릭스 (확정 전 구현 금지)

| # | 결정 항목 | **확정값** | 영향 파일 |
|---|---|---|---|
| **D1** ✅ | **라우트 형태** | **Route Handler** `POST /api/hapcards/[id]/replay` | `api_routes.md:15` 정정 완료(§12), `src/app/api/hapcards/[id]/replay/route.ts` 신규 |
| **D2** ✅ | **요금** | **4p 차감** (원본 8p 의 50%) | `token_ledger` INSERT delta = `-4`, UI 안내 "다시합 4토큰" |
| **D3** ✅ | **레이트리미트** | **무제한** — 4p 부담 자체가 자연 게이트. Idempotency(`jinjin_date` UNIQUE)만 적용 | `REPLAY_RATE_LIMITED` 에러 코드 미사용. `0023_replay_idempotency.sql` 신규 |
| **D4** ✅ | **`token_ledger.reason` 네이밍** | **`'replay_use'`** (`db_schema.md:319` canonical) / 환불 `'replay_refund'` | `payments.md:271` 정정 완료(§12) |

---

## 3. Request Schema (Zod, 결정 후 확정)

```ts
// Route Handler (D1=A 선택 시)
export const ReplayRequestSchema = z.object({
  replay_reason: z.string().max(500).optional(), // 유저 입력 재해석 사유
}).strict();

// hapcard_id는 URL 경로 파라미터 [id]로 전달
```

---

## 4. Response Schema

기존 `HapcardResult` 구조 + `replay_id` 필드:

```ts
export interface HapcardReplayResult extends HapcardResult {
  replay_id: string;
}
```

LLM context 변경: 원본 해석과 달리 일진/주운/월운만 갱신된 시간 변수를 system prompt에 주입. `chart_core`·`scoring` 불변.

---

## 5. Error Codes

| HTTP | Code | 설명 |
|---|---|---|
| 400 | `INVALID_BODY` | Zod strict parse 실패 |
| 401 | `UNAUTHORIZED` | 미인증 |
| 402 | `INSUFFICIENT_TOKENS` | 토큰 잔액 부족 (4p 미만) |
| 404 | `HAPCARD_NOT_FOUND` | hapcard_id 미존재 또는 다른 user 소유 |
| 429 | `REPLAY_RATE_LIMITED` | 레이트리미트 초과 (D3 결정 후 조건 확정) |
| 503 | `REPLAY_DURING_OUTAGE` | Anthropic/OpenAI 장애 중 비활성 (`docs/runbooks/anthropic_outage.md:35`) |
| 500 | `INTERNAL_ERROR` | DB / LLM / 기타 미분류 오류 |

---

## 6. Idempotency

동일 `(hapcard_id, jinjin_date)` 2회 호출 시 첫 호출 결과 반환(no double charge).

D3=무제한 결정에 따라 rate-limit constraint 없음. Idempotency 전용 unique constraint 사용:
- `supabase/migrations/0023_replay_idempotency.sql` — `jinjin_date date NOT NULL` 컬럼 추가 + `UNIQUE(hapcard_id, jinjin_date)`
- cache key 조회 후 hit → 기존 `hapcard_replays` 행 반환, 토큰 차감 X

---

## 7. Token Ledger Flow

트랜잭션 보장(서비스 역할 클라이언트 사용):

```
1. supabase.rpc('deduct_tokens', { uid, delta: -4, reason: 'replay_use', ref: hapcard_id })
   → 잔액 부족 → INSUFFICIENT_TOKENS(402) 반환
2. LLM call (replay context)
3. hapcard_replays INSERT
4. 실패 시: supabase.rpc('refund_tokens', { uid, delta: +4, reason: 'replay_refund', ref: hapcard_id })
```

---

## 8. Cache Key (ADR-036)

```
replay_cache_key = sha256(chart_hash | scoring_version | prompt_version | jinjin_date)
```

- `jinjin_date` = `YYYY-MM-DD` (일진 날짜, UTC+9)
- cache hit → 기존 `hapcard_replays` 행 반환 (토큰 차감 X)
- cache TTL: 30일 (`hapcards.archived_at` 정책 동일)

---

## 9. Outage Behavior

`docs/runbooks/anthropic_outage.md:35` 참조:
- Anthropic/OpenAI SLA 장애 감지 시 → `REPLAY_DURING_OUTAGE(503)` 응답
- UI: "현재 다시합 서비스가 잠시 중단되었어요" 인라인 메시지

---

## 10. System Prompt

신규 prompt 파일 불필요. 기존 6모드 `prompts/system/{mode}.md` 재사용.
replay context 구분: system prompt 첫 줄 `[재해석 모드]` 태그 추가 + 변경된 시간 변수 삽입.

---

## 11. 참조

- `supabase/migrations/0007_hapcard_replays.sql` — 테이블 스키마
- `docs/specs/db_schema.md:319` — `token_ledger.reason` canonical 값
- `docs/specs/api_routes.md:15` — Server Action 기재 (D1 결정 후 수정 필요)
- `docs/specs/payments.md` — D4 결정 후 `'replay'` → `'replay_use'` 정정 필요
- `docs/specs/llm_grounding.md` — ADR-015 재해석 명리 근거 표시 의무
- `fluttering-gathering-island.md §4.3` — Phase 1.5 관계 진화 타임라인 재해석
- `src/app/api/hapcards/route.ts:1-117` — D1=A 선택 시 참조 패턴

---

## 12. 다음 세션 진입점

```
§1.1 결정 4건 확정 순서:
1. D1: 라우트 형태 확정 (Route Handler 추천)
2. D2: 요금 확정 (4p 추천)
3. D3: 레이트리미트 정책 결정 (TBD-5 해소)
4. D4: token_ledger.reason 확정 ('replay_use' 추천)

확정 후:
→ api_routes.md + db_schema.md + payments.md 동시 갱신 (§12 의무)
→ types/hapcard.ts에 HapcardReplayResult 추가
→ TDD 진입: tests/app/api/hapcards/[id]/replay/route.test.ts RED 작성
```
