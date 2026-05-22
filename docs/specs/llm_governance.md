# llm_governance.md — LLM 호출 거버넌스 명세

> **게이트**: Phase 0 G2
> **ADR 참조**: ADR-002 (자유채팅 미제공), ADR-035 (점수 결정형)
> **PII 규칙**: `docs/legal/pii_minimization.md` 참조 (gender/birth_place → 절대 미전달)

---

## 1. 비용 통제

### 1.1 일 예산 자동 차단

환경 변수 `LLM_DAILY_BUDGET_USD` (기본값: 20).

```typescript
// supabase/functions/interpret/index.ts (발췌)
const dailyBudget = Number(Deno.env.get('LLM_DAILY_BUDGET_USD')) ?? 20;
const today = new Date().toISOString().slice(0, 10);

const { data: usage } = await supabase
  .from('llm_cost_tracking')
  .select('total_usd')
  .eq('date', today)
  .eq('provider', 'openai')
  .single();

if ((usage?.total_usd ?? 0) >= dailyBudget * 0.95) {
  // Slack 알림 (95% 도달)
  await notifySlack('LLM 일 예산 95% 도달');
}

if ((usage?.total_usd ?? 0) >= dailyBudget) {
  return errorResponse('USER_QUOTA_EXCEEDED', 429,
    '오늘의 서비스 용량을 모두 사용했어요. 내일 다시 찾아주세요.');
}
```

### 1.2 레이어별 쿼터

| 레이어 | 제어 방식 | 기본값 |
|---|---|---|
| 유저별 일 상한 | `user_quotas` 테이블 증분 | 비회원 3회, 회원 20회 |
| 유저별 월 상한 | 동 | 회원 300회 |
| 글로벌 일 상한 | `llm_cost_tracking` + 자동 차단 | $20 (OpenAI) |
| 결과 캐시 | `hapcards.cache_key` | KST `target_date`별 |
| Daily Hap 캐시 | `daily_haps` 테이블 | 당일만 |

### 1.3 캐시 키

```typescript
const cacheKey = sha256(
  user_chart_hash + relation_chart_hash + mode + prompt_version + theory_profile_version + target_date
);
```

---

## 2. 프롬프트 주입 방어

### 2.1 위험 지점

- `relations.nickname` 필드 (유저 자유 입력)
- Daily Hap 생성 시 유저 컨텍스트 요약

### 2.2 방어 계층

**1단: 입력 sanitize**

```typescript
// src/lib/llm/sanitize.ts
export function sanitizeUserInput(raw: string): string {
  return raw
    .replace(/[<>{}]/g, '')
    .replace(/system prompt|ignore previous|disregard/gi, '')
    .trim()
    .slice(0, 200);
}
```

**2단: 프롬프트 구조 고정** — 유저 입력은 항상 `<user_input>...</user_input>` 태그 내부 배치. 시스템 지시는 태그 바깥·앞.

**3단: 출력 후처리 검증**

- `banned_phrases_catalog.yaml` 필터 (§ llm_quality_regression.md)
- 응답이 예상 JSON 스키마 벗어나면 재시도 또는 fallback
- "시스템 프롬프트 노출" 패턴 감지 (응답에 `You are a fortune teller` 포함 시 차단)

**4단: 레이트 제한**

- IP 기반 1분당 10회, 1시간당 60회
- `anon_requests` 테이블로 분당 버킷 카운트

---

## 3. ZDR 정책

LLM 제공사 로그에 PII를 남기지 않기 위한 전략. 세부 규칙은 `docs/legal/pii_minimization.md` 참조.

**LLM 페이로드에 허용되는 것**:
- `chart_core` (사주 4주 stem/branch, 오행 분포, 신살 태그)
- `question_slot` (모드 슬롯)
- `theory_profile.profile_version`

**LLM 페이로드에 절대 포함 금지**:
- `birth_date`, `birth_time`, `birth_place` (원본)
- `nickname`, `email`
- `gender` (원본)
- `user_id`, `relation_id`

---

## 4. 모니터링 지표

| 지표 | 알람 임계값 | 대응 |
|---|---|---|
| LLM 호출 실패율 (5xx) | > 2% / 5분 | Slack 알림 |
| LLM p95 응답시간 | > 8초 | Slack 알림 |
| 유저당 일 쿼터 도달률 | > 5% | 스팸 유입 의심, 수동 검토 |
| 글로벌 일 LLM 비용 | > $20 | 자동 차단 |
| banned_phrase 감지율 | > 1% | 프롬프트 품질 회귀 의심 |
| LLM-as-judge 평균 | < 3.5 | 배포 차단, 롤백 |

---

## 5. 프롬프트 카나리 배포

### 5.1 prompt_versions 테이블

```sql
-- 상태 전이: active → canary → active (승격) 또는 rolled_back
-- active 상태는 prompt_name 당 하나만 허용 (unique index)
```

### 5.2 배포 절차

1. 새 버전 업로드: `status: 'canary'`, `canary_ratio: 0.05` (5%)
2. 트래픽 분기: Edge Function이 `user_id` 해시 기반으로 5%에게 신버전 적용
3. 모니터링 기간: 72시간 동안 LLM-as-judge / banned_phrase / 유저 피드백 집계
4. 승격 조건:
   - LLM-as-judge 평점 신버전 ≥ 구버전 (유의미 하락 없음)
   - banned_phrase 감지율 < 1%
   - 유저 👎 비율 신버전 ≤ 구버전 × 1.1
5. 승격: 구버전 → `rolled_back`, 신버전 → `active`
6. 롤백: 조건 미달 시 신버전 → `rolled_back`, 구버전 유지

### 5.3 즉시 롤백 트리거

- `banned_phrase` 감지율 > 3% (5분 기준)
- LLM-as-judge 평균 < 3.0
- 유저 👎 비율 > 20%

롤백 SQL: `docs/runbooks/prompt_rollback.md` 참조.

---

## 6. Circuit Breaker (OpenAI → Claude Fallback)

```
OpenAI 5xx > 20% / 5분
    ↓
해당 공급사 30분간 skip
    ↓
fallback: Claude Sonnet 4.6 로 전환
    ↓ (Claude도 장애 시)
캐시된 hapcards만 노출 + "일시 점검 중" 배너
    ↓ (신규 요청 시)
에러 코드 LLM_ALL_PROVIDERS_DOWN 반환
```

---

## 7. G2 체크리스트

- [ ] `user_quotas` 테이블 + 증분 UPSERT 함수
- [ ] `llm_cost_tracking` 테이블 + 매 호출 후 incremental upsert
- [ ] `LLM_DAILY_BUDGET_USD` 환경 변수 설정 (기본 $20)
- [ ] `sanitizeUserInput()` 함수 + 단위 테스트
- [ ] 프롬프트 템플릿 `<user_input>` 태그 구조 적용
- [ ] IP 레이트 리밋 (`anon_requests` 테이블 + 분당 버킷)
- [ ] OpenAI 예산 알람 설정 (95% 경고, 100% 차단)
- [ ] API 키 3종 분리 (Prod / Staging / CI-Regression)
- [ ] Sentry 5종 알람 설정
- [ ] `prompt_versions` 테이블 + 카나리 분기 로직
- [ ] Circuit breaker 구현 (30분 skip, Claude fallback)
- [ ] PII 최소화 grep 테스트 (YYYY-MM-DD 패턴 LLM 페이로드 검출 시 실패)
- [ ] ZDR 정책 문서화 + Privacy Policy 반영
