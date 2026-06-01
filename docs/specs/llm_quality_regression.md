# llm_quality_regression.md — LLM 품질 회귀 테스트 명세

> **게이트**: Phase 0 G2 (배포 전 필수), 이후 주간 자동 실행
> **ADR 참조**: ADR-002 (자유채팅 미제공), ADR-035 (점수 결정형)
> **모델 매핑**: OpenAI 4-tier (gpt-5 / gpt-5-mini), Claude fallback 전용

---

## 1. 문제 정의

사주 해석의 결정론(ADR-035)만으로는 "서로 다른 입력에 충분히 다른 출력이 나오는가"를 보장하지 못한다. 금지어 필터와 LLM-as-Judge 없이는 "일관되게 두루뭉술한 서비스"가 될 수 있다.

**QR Test**: 각 릴리스마다 100건 샘플 출력에 banned_phrases grep + LLM-as-Judge 4축 평가를 실행한다.

---

## 2. 품질 게이트 상수

```typescript
// src/lib/llm/quality_gates.ts
export const QUALITY_GATES = {
  max_pairwise_similarity: 0.6,       // 서로 다른 입력 → 다른 출력
  min_tag_references: 3,              // chart_core 요소 최소 언급 횟수
  min_cause_grounding_ratio: 1.0,     // cause_factors 전부 근거 있어야 함
  max_banned_per_response: 0,         // 금지어 0건
  llm_judge_pass_threshold: 3.5,      // 5점 만점 기준
  llm_judge_warn_threshold: 3.8,
  max_banned_phrase_rate: 0.03,       // 3% 초과 시 롤백 트리거
  max_thumbsdown_rate: 0.20,          // 20% 초과 시 롤백 트리거
};
```

---

## 3. 금지어 사전 (`prompts/banned_phrases_catalog.yaml`)

```yaml
# prompts/banned_phrases_catalog.yaml
categories:
  generic_encouragement:
    - "성실한 분"
    - "노력하시면"
    - "꾸준히 하시면"
    - "긍정적인 마음"
    - "잘 될 것입니다"
    - "좋은 일이 있을"

  context_blind:
    - "전반적으로"
    - "대체로"
    - "주변 사람들과"
    - "평소처럼"

  time_generalization:
    - "새해에는"
    - "올해는"
    - "요즘"
    - "최근"

  fear_exaggeration:
    - "주의하셔야 합니다"   # 구체 근거 없이 사용 시 금지
    - "조심해야"

  abstract_validation:
    - "당신은 소중한"
    - "있는 그대로의"
```

**컨텍스트 인식 필터**: 금지어 + chart_core 데이터 참조가 같은 문장에 있으면 허용. 예: "꾸준히 하시면 좋습니다"는 금지, "壬水 일간의 관성 과다 패턴에서 꾸준히 하시면..."은 허용.

---

## 4. 운영 중 지속 회귀 루프

### 4.1 트리거 조건

- GitHub Actions 매주 월요일 03:00 KST 자동 실행
- 프롬프트 변경 PR merge 시 자동 트리거
- RAG 자산 변경 시 자동 트리거

### 4.2 실패 시 행동

- 배포 차단 (main merge block)
- Slack 알림 → Phil 수동 검토
- 프롬프트 롤백 절차: `docs/runbooks/prompt_rollback.md` 참조

### 4.3 비용 보호

CI의 LLM 호출은 전용 "ci-regression" API 키 사용. 월 상한 $50 설정, 초과 시 자동 차단.

---

## 5. 샘플 큐레이션

### 5.1 기본 구성

**10건 × 6모드 = 60건** (최소). 릴리스마다 동일 샘플 세트 사용 (재현성 보장).

| 모드 | 샘플 수 | 비고 |
|---|---|---|
| 일합 | 10 | 일상 관계 |
| 친구합 | 10 | 동성/이성 친구 조합 |
| 돈합 | 10 | 비즈니스 파트너 |
| 첫합 | 10 | 첫 만남 설렘 |
| 썸합 | 10 | 연애 가능성 탐색 |
| 오래합 | 10 | 장기 관계 심화 |

### 5.2 자동 선별

- `ssaju.toCompact()`로 특성 벡터 추출 → K-means 클러스터링 → 극단적 10개 자동 선별
- 오픈소스 테스트 케이스 (manseryeok-js 샘플, fortuneteller 경계 케이스) 포함
- Python 스크립트 `scripts/curate_qr_samples.py`로 재현 가능

---

## 6. LLM-as-Judge 평가 기준

### 6.1 심사 프롬프트 구조

```markdown
# 심사관 역할
당신은 명리학에 소양이 있는 심사관입니다.
아래 사주 해석이 다음 4축을 만족하는지 각 1~5점으로 평가해주세요.

## 평가 대상
chart_core: {chart_core_data}
interpretation: {interpretation_text}

## 4축 평가 기준

1. **사주 특성 반영도** (1~5점)
   chart_core의 실제 요소(예: "금 과다, 화 부족")가 본문에 명시적으로 언급되는가?

2. **근거 구체성** (1~5점)
   cause_factors가 피상적("전반적으로")이지 않고 특정 사주 요소를 짚는가?

3. **현대어 자연스러움** (1~5점)
   명리 용어를 그대로 던지지 않고 상황 언어로 번역되었는가?

4. **안전성** (1~5점)
   의료·법률·투자 결정을 단정하지 않는가? 면책 관련 표현이 있는가?

## 출력 형식 (JSON)
{
  "scores": { "specificity": 4, "grounding": 3, "naturalness": 5, "safety": 5 },
  "average": 4.25,
  "reasoning": "...",
  "pass": true
}
```

### 6.2 판정 기준

| 평균 점수 | 판정 |
|---|---|
| ≥ 3.8 | PASS |
| 3.5 ~ 3.8 | WARN (다음 주 재측정) |
| < 3.5 | FAIL (배포 차단, 프롬프트 롤백) |

### 6.3 샘플 수 및 비용

- 주간 QR: 무작위 50건 샘플 심사
- 모델: gpt-5-mini (심사관 역할)
- 예상 비용: 50건 × ~$0.001 ≈ **주 $0.05** (실질 무료)

**한계**: LLM 심사도 오류 가능. 반복 측정 시 인간 평가와 상관관계 0.7+ 수준(G-Eval 계열). 절대 기준이 아닌 **회귀 감지**용으로 사용.

---

## 7. FeedbackEvent 스키마

```typescript
// src/types/feedback.ts
export interface FeedbackEvent {
  event_id: string;
  user_id: string;
  target_type: 'hapcard' | 'hapcard_replay' | 'daily_hap' | 'knowledge_asset';
  target_id: string;
  signal: 'thumbs_up' | 'thumbs_down' | 'inspect';
  quality_issue_flag?:
    | 'generic'
    | 'vague'
    | 'wrong_context'
    | 'classic_translation'
    | 'other'
    | null;
  quality_issue_note?: string;
  created_at: string;
}
```

---

## 8. 운영 회귀 루프 (배포 후)

```
배포 완료
    ↓
카나리 5% → 72시간 모니터링
    ↓
지표 체크:
  - banned_phrase 감지율 < 3%?     → 초과 시 즉시 롤백
  - LLM-as-judge 평균 ≥ 3.5?      → 미달 시 롤백
  - 유저 👎 비율 < 20%?            → 초과 시 롤백
    ↓
전부 통과 → 100% 트래픽 승격
```

---

## 9. ADR-008 카나리 롤백 SQL

```sql
-- prompt_versions 테이블 기반 즉시 롤백
-- 현재 canary 버전을 rolled_back으로, 이전 active 버전을 active로 복원
UPDATE public.prompt_versions
  SET status = 'rolled_back'
  WHERE prompt_name = 'hapcard_main'
    AND status = 'canary';

-- 이전 버전 active 복원 (별도 트랜잭션)
UPDATE public.prompt_versions
  SET status = 'active'
  WHERE prompt_name = 'hapcard_main'
    AND version = 'v1.2';  -- 롤백 대상 이전 버전
```

---

## 10. 모델 매핑 (OpenAI 4-tier)

| 용도 | 모델 | 이유 |
|---|---|---|
| 핵심 합카드 해석 (관계 해석 8p) | `gpt-5` | 가장 높은 품질, 정확한 명리 반영 |
| 딥합 (깊이 리포트) | `gpt-5` | 장문 심층 분석 |
| 오늘합 (Daily Card) | `gpt-5-mini` | 짧고 반복적 출력, 비용 최소화 |
| LLM-as-Judge (CI) | `gpt-5-mini` | 심사 비용 최소화 |
| 장애 fallback | `ANTHROPIC_FALLBACK_MODEL` (기본 `claude-sonnet-4-5`) | OpenAI 전체 장애 시에만 |

> Anthropic Claude를 1차 모델로 쓰는 전략은 채택하지 않는다. Claude는 fallback 전용.

---

## 11. G2 체크리스트

- [ ] `prompts/banned_phrases_catalog.yaml` 5개 카테고리 작성
- [ ] banned_phrases grep 스크립트 (`scripts/check_banned_phrases.ts`)
- [ ] QR 샘플 60건 큐레이션 (6모드 × 10건)
- [ ] LLM-as-Judge 심사 프롬프트 작성
- [ ] GitHub Actions 주간 QR 워크플로우 설정
- [ ] `ci-regression` API 키 분리 (Prod/Staging/CI 독립)
- [ ] 월 $50 상한 설정
- [ ] 실패 시 Slack 알림 + 배포 차단 설정
- [ ] `FeedbackEvent` 타입 + DB 테이블 (`docs/specs/db_schema.md` 참조)
- [ ] 피드백 버튼 UI 컴포넌트 (👍/👎/🔍)
