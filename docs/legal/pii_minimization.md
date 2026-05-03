# PII 최소화 단일 정의 (ADR-004 / ADR-011 통합)

> 본 문서는 LLM에 절대 전달하지 않는 PII 필드의 단일 truth source다. CLAUDE.md §5, tech_stack.md §3.5, FRONTEND-PREP.md §11.2, fluttering-gathering-island.md §6.4는 본 문서를 참조한다.

## 5필드 + gender 원칙

OpenAI/Claude/그 외 외부 LLM API 페이로드에 **절대 포함하지 않는** 필드:

| # | 필드 | 출처 | 예외 |
|---|---|---|---|
| 1 | `birth_date` (원본) | user.birth_date / relation.birth_date | 없음. `chart_core.year_pillar` 등 가공 결과만 전달. |
| 2 | `name` | user.name (본인 실명) | 없음. |
| 3 | `nickname` | relation.nickname (인연 별명) | 없음. ADR-011: 별명도 LLM 페이로드에서 제외. |
| 4 | `email` | user.email, auth | 없음. |
| 5 | `birth_place` | user.birth_place, relation.birth_place | 없음. KASI 경도 보정은 chart 계산 시 사용 후 폐기. |
| 6 | `gender` (원본) | user.gender, relation.gender | 없음. 십신·오행 가중에 사용 후 `chart_core.gender_normalized`로만 전달. |

> **gender 포함 근거**: CLAUDE.md §5는 6필드(birth_date, name, nickname, email, birth_place, gender) 모두 미전달을 명시. 이전 스펙(fortune_architecture.md §7.6)에서 gender·birth_place를 LLM 위탁 가능으로 분류한 것은 ADR-004·CLAUDE §5와 충돌하므로 **무효**다.

## LLM 허용 페이로드

```typescript
{
  chart_core: ChartCore,           // 천간·지지 4쌍 + 오행 분포 + 십신 매핑
  question_slot: QuestionSlot,     // 6모드 코드 + 컨텍스트 selector
  theory_profile: { profile_version: string }  // 이론 버전만
}
```

ZDR(Zero Data Retention) 계약은 OpenAI/Anthropic 모두 적용 의무 (ADR-037, tech_stack §3.5).

## 위반 시 절차

코드 리뷰에서 5필드 + gender 원본이 LLM 페이로드 직렬화 경로에 포함된 것을 발견하면:
1. 즉시 PR 차단
2. CLAUDE.md §1.1에 따라 사용자 보고
3. ADR-004 위반으로 기록

## 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| v1.0 | 2026-05-03 | 본 문서 작성 (단일 truth source 통합). 기존 4개 문서의 표현 차이 통일. |
