# llm_grounding.md — 원문 인용 기반 Grounding 명세

> **게이트**: Phase 0 G4
> **ADR 참조**: ADR-015 (재해석 시 명리 근거 항상 표시), ADR-023 (명리 산정 → 고전 원문 2단 펼침)
> **단일 truth source**: 본 파일. fortune_architecture.md §4 는 폐기됨.

---

## 1. 목적

포스텔러의 "역술가 편찬" 권위를 **검증 가능한 고전 원문 인용**으로 대체한다. 유저가 "AI가 만들어낸 덕담"과 "명리 고전에 근거한 해석"을 구분할 수 있게 한다.

---

## 2. KnowledgeCitation 인터페이스

```typescript
// src/types/citation.ts
export interface KnowledgeCitation {
  asset_id: string;
  asset_type: 'classic' | 'concept_dict' | 'modern_translation' | 'safety_rule';
  topic_tags: string[];
  excerpt_hash: string;              // original_text SHA-256
  display?: ClassicExcerptDisplay;   // 유저 노출용
}

export interface ClassicExcerptDisplay {
  source_title: string;              // 예: "적천수 (滴天髓)"
  source_chapter: string;            // 예: "通神頌"
  original_text: string;             // 한문 원문 (정확히 일치해야 함)
  original_reading?: string;         // 한글 독음 (예: "관다자신약, 식상가용")
  modern_translation: string;        // 자체 현대어 번역 (40~80자)
  relevance_explanation: string;     // 이 해석과의 연관성 설명
  reference_url?: string;            // 한국고전종합DB 원문 URL
}
```

---

## 3. 결과 페이지 UI: 근거 보기 2단 펼침 (ADR-023)

```
┌─────────────────────────────────────────────┐
│ 이 해석의 명리 근거                          │
│                                             │
│ [명리 산정 보기 ▼]                          │  ← 1단: 사주 요소 설명
│                                             │
│   壬水 일간 + 官星 과다 = 책임 압박 구조     │
│   五行 분포: 金3 水1 木0 火2 土2             │
│                                             │
│ [고전 원문 보기 ▼]                          │  ← 2단: 고전 인용
│                                             │
│   『적천수』 通神頌                          │
│                                             │
│   "官多者身弱, 食傷可用"                    │
│   (관다자신약, 식상가용)                    │
│                                             │
│   현대어: 관성(압박·책임)이 많아 자신의      │
│   힘이 약할 때는, 식신·상관(표현·창의)을     │
│   활용해 균형을 잡는다.                      │
│                                             │
│   [출처 보기 ↗]  (한국고전종합DB)            │
└─────────────────────────────────────────────┘
```

**접근성 고려**:
- 한자 원문 위 `<ruby>` 태그로 한글 독음 병기
- `aria-label="고전 원문"` 지정 (스크린리더용)
- `prefers-reduced-motion` 대응: 펼침 애니메이션 생략

---

## 4. RAG 자산 구조

### 4.1 knowledge_assets 테이블

`docs/specs/db_schema.md` §13 참조. 핵심 컬럼:

```sql
knowledge_assets (
  asset_id      text primary key,            -- 예: 'classic_jcs_001'
  asset_type    text,                         -- 'classic' | 'concept_dict' | ...
  topic_tags    text[],                       -- ['official_overload', 'weak_daymaster']
  content       jsonb,                        -- ClassicExcerptDisplay 구조
  embedding     vector(1536),                 -- OpenAI text-embedding-ada-002
  review_status text                          -- 검증 단계 상태
)
```

### 4.2 YAML 자산 예시

```yaml
# rag_content/classics/jeokcheonsu_001.yaml
asset_id: classic_jcs_001
asset_type: classic
source_title: "적천수 (滴天髓)"
source_chapter: "通神頌"
topic_tags:
  - official_overload
  - food_god_usage
  - weak_daymaster_balance

original_text: "官多者身弱, 食傷可用"
original_reading: "관다자신약, 식상가용"
modern_translation: >
  관성(압박·책임)이 많아 자신의 힘이 약할 때는,
  식신·상관(표현·창의)을 활용해 균형을 잡는다.

relevance_templates:
  - trigger_tags: [pressure_sensitive, weak_daymaster]
    explanation_template: >
      당신의 사주에서 {pressure_source}(관성)의 압력이 크게 작용하므로,
      직설보다 {expression_channel}으로 풀어가는 것이 유효합니다.

reference_url: "https://db.itkc.or.kr/..."
review_status: "approved_ai_pending_human"
```

**review_status 상태 진화**:
```
draft
  → approved_ai_pending_human  (AI 2중 교차 검증 완료)
  → approved_ai_and_crowd      (명리 커뮤니티 크라우드 검수 완료)
  → approved_ai_crowd_and_beta (베타 피드백 승격)
  → deprecated
```

### 4.3 Phase 0 MVP 자산 목표

| Phase | 목표 건 수 | 상태 |
|---|---|---|
| G4 (Phase 0 출시 전) | 20건 | approved_ai_and_crowd |
| Phase 1.1 (출시 후 1개월) | +30건 (총 50건) | approved_ai_and_crowd |
| Phase 3 | 100건+ | approved_ai_crowd_and_beta |

---

## 5. 프롬프트 원문 인용 강제

```markdown
## OUTPUT STRUCTURE (반드시 준수)

1. main_text (150~200자)
2. cause_factors (3개, 각각 chart_core 요소 참조 필수)
3. classic_citation (rag_chunks에 classic 타입이 있으면 필수)
   - original_text: 원문 그대로 사용 (변형 금지)
   - modern_translation: 자산에 기록된 그대로 사용 (변형 금지)
   - relevance_explanation: 이 해석과의 연관성 1~2문장
4. actions (3개)
```

---

## 6. 원문 일치 검증 (Hallucination 방지)

```typescript
// src/lib/llm/grounding_validator.ts
export function validateClassicCitation(
  llmOutput: HapcardContent,
  ragChunks: KnowledgeCitation[]
): ValidationResult {
  if (!llmOutput.classic_citation) return { valid: true, skipped: true };

  const referenced = ragChunks.find(
    c => c.asset_id === llmOutput.classic_citation?.asset_id
  );
  if (!referenced?.display) return { valid: false, reason: 'RAG_CLASSIC_MISS' };

  // 원문 정확히 일치 확인 (string exact match)
  const originalMatch =
    llmOutput.classic_citation.original_text === referenced.display.original_text;
  const translationMatch =
    llmOutput.classic_citation.modern_translation === referenced.display.modern_translation;

  if (!originalMatch || !translationMatch) {
    return {
      valid: false,
      reason: 'CLASSIC_TEXT_MISMATCH',
      detail: { originalMatch, translationMatch },
    };
  }

  return { valid: true };
}
```

**pgvector 유사도 임계값**:
- 코사인 유사도 > 0.75: 고전 인용 포함
- 0.60~0.75: 선택적 포함 (모드에 따라)
- < 0.60: 고전 인용 섹션 생략 (`RAG_CLASSIC_MISS`)

**HNSW 인덱스 사용**: `knowledge_assets.embedding` 컬럼에 HNSW 인덱스 (1,000건 이상 권장). Phase 0 MVP는 20건이므로 Sequential Scan도 충분.

---

## 7. 고전 자산 3중 검증 (ADR-018)

### 7.1 게이트 1 — AI 2중 교차 검증 (Phase 0, 모든 자산)

- GPT-5o로 1차 검증: "이 번역이 원문 의미를 왜곡하지 않는가"
- Claude Sonnet 4.6으로 2차 독립 검증 (프롬프트 영어로 변경)
- 두 AI 결과 비교 → 이견 항목만 수동 재검토
- 통과 시 `review_status: "approved_ai_pending_human"`

### 7.2 게이트 2 — 명리 커뮤니티 크라우드 검수 (Phase 0, 출시 직전)

- 네이버 카페·디스코드·지인 네트워크에서 명리학 지식자 3~5명 섭외 (무료, 서포터즈 크레딧 교환)
- 20건 번역본을 Google Form으로 배포 → 번역 정확도 1~5점 평가
- 평균 평점 < 3.5인 항목은 재작성 → `review_status: "approved_ai_and_crowd"`

**섭외 실패 시 플랜**:
| 플랜 | 조건 | 대응 |
|---|---|---|
| B1 — 유료 감수 | 7일 후 0명 | $30~50/건 크레딧 교환, 최대 20건 |
| B2 — AI-only 출시 | B1 불가 | `approved_ai_only` 라벨 + UI 배지 노출 |
| B3 — Phase 0 연장 | 전면 재시도 | 최대 2주 연장 |

### 7.3 게이트 3 — 베타 유저 피드백 (Phase 1 이후)

- 고전 인용 섹션 하단 피드백 버튼 (👍/👎/🔍)
- 👎 누적 5건 이상 또는 비율 > 10% → 재검토 대상
- `review_status: "approved_ai_crowd_and_beta"` 승격 기준: 👎 비율 < 5%

---

## 8. 데이터 소스 (공개·무료)

| DB | URL | 용도 |
|---|---|---|
| 한국고전종합DB | https://db.itkc.or.kr | 명리 3대 고서 원문 + 공식 번역 |
| 동양고전종합DB | http://db.cyberseodang.or.kr | 해설·주석 보조 |
| 규장각 원문검색 | https://kyudb.snu.ac.kr | 원문 이미지 |

**중요**: 한국고전종합DB 번역문 직접 인용 금지. 자체 현대어 번역이 기본 방침. 원문은 저작권 만료 공공재.

---

## 9. G4 체크리스트

- [ ] `KnowledgeCitation.display` 필드 + `ClassicExcerptDisplay` 타입 정의
- [ ] 한국고전종합DB에서 원문 20건 수집
- [ ] 자체 번역 작성 (각 40~80자)
- [ ] **게이트 1** AI 교차 검증 (GPT-5o + Claude Sonnet 4.6)
- [ ] **게이트 2** 명리 커뮤니티 섭외 (최소 1명) + Google Form 배포
- [ ] 크라우드 평점 집계 → 재작성 필요 항목 반영
- [ ] `review_status: "approved_ai_and_crowd"` 부여
- [ ] `rag_content/classics/` 20건 YAML 파일 — *(시드 인프라 완료: `scripts/seed-classics.ts` + `pnpm seed:classics`, commit `d922182`. YAML 20건은 명리 specialist 도메인 작업으로 별도 진행)*
- [ ] knowledge_assets 테이블 20건 insert — *(`supabase db push 0021_classics` 사용자 수동 완료 후 `pnpm seed:classics` 실행)*
- [ ] pgvector 임베딩 생성 (Supabase Edge Function)
- [ ] 프롬프트 템플릿 `classic_citation` 섹션 추가
- [ ] `validateClassicCitation()` 함수 + 단위 테스트
- [ ] 결과 페이지 "참고한 고전" 섹션 + `<ruby>` 접근성
- [ ] `RAG_CLASSIC_MISS` 에러 처리 (조건부 섹션 생략)
- [ ] 번역 피드백 버튼 UI (Phase 1.0 활성)

**예상 공수**: 7일 (정상 경로). 플랜 B1 진입 시 +3일, B3 진입 시 +2주.
