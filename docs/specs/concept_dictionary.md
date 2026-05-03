# concept_dictionary.md — 학습 콘텐츠 레이어 명세

> **Phase**: 1.5+ (Phase 1 MVP 미포함)
> **ADR 참조**: ADR-028 (학습 카드 시리즈 Phase 2), ADR-010 (단일 핵심 위계 — 보조 콘텐츠가 핵심을 가리지 않음)

---

## 1. 개요

명리 개념을 유저가 직접 학습할 수 있는 레이어. **Phase 1 MVP에는 배우기 탭이 없다.** 오행 5종은 홈 상단 "학습 프리뷰 카드"로 맛보기만 제공.

본격 탭 진입은 **Phase 3** (십성 10종 + 신살 12종 완성 시점).

---

## 2. Phase별 범위

| Phase | 범위 | 네비 위치 |
|---|---|---|
| **Phase 1 MVP** | 오행 5종 프리뷰 카드 (홈 상단) | 홈 탭 인라인 |
| **Phase 1.5** | 개념 카드 시리즈 초안 | 더보기 탭 링크 |
| **Phase 2 (ADR-028)** | 학습 카드 시리즈 정식 | 더보기 탭 |
| **Phase 3** | 십성 10종 + 신살 12종 추가 (총 37종) | **배우기 탭** (메인 네비 4탭) |

---

## 3. 콘텐츠 타입

| 타입 | 항목 수 | Phase |
|---|---|---|
| 오행 (ilju) 카드 | 5 | Phase 1 (프리뷰) |
| 십신 (sipsin) 카드 | 10 | Phase 3 |
| 합·충·형·해 (hapChungHyungHae) 카드 | 약 12 | Phase 3 |
| 오행 심화 (ohaeng) | 5 | Phase 3 |
| 12신살 | 12 | Phase 3 |
| 길성·흉성 | 약 15 | Phase 4 |

---

## 4. 카드 구조: 1개념 + 1고전 인용

```typescript
// src/types/concept.ts
export interface ConceptAsset {
  concept_id: string;
  domain: 'five_elements' | 'ten_gods' | 'interactions' | 'twelve_spirits' | 'stars';
  korean_name: string;
  hanja: string;
  short_definition: string;       // 10자 이내 태그라인
  long_explanation: string;       // 200~400자
  traits: {
    positive: string[];
    negative: string[];
    balance_when_strong: string;
    balance_when_weak: string;
  };
  chart_integration: {
    how_to_find_in_my_chart: string;
    typical_manifestations: string[];
  };
  related_classics?: string[];    // knowledge_asset asset_id 참조
  share_card: {
    visual_style: string;
    tagline: string;
    color_palette: string[];
  };
  curated_at: string;
  version: string;
}
```

---

## 5. Phase 1 MVP: 홈 학습 프리뷰 카드

```
┌─────────────────────────────────────┐
│ 오늘 배워볼 오행                     │
│                                     │
│ 火(화) · 타오르는 순간의 에너지       │
│                                     │
│ 당신 사주에서 가장 강한 요소입니다.  │
│ [자세히 보기 →]                      │
└─────────────────────────────────────┘
```

- 홈 탭 상단 (일 1회 갱신)
- 클릭 → 개념 상세 페이지 (더보기 탭 내)
- KPI: 클릭률 > 20%

---

## 6. Phase 3 배우기 탭 (4탭 구조)

```
┌────────────────────────────────────────┐
│   홈    │  질문  │ 배우기 │ 더보기    │
└────────────────────────────────────────┘
```

승격 조건: 십성 10종 + 신살 12종 완성. 빈 탭 방지.

---

## 7. G3/Phase 1.5 체크리스트

- [ ] `ConceptAsset` 타입 정의 (`src/types/concept.ts`)
- [ ] 오행 5종 YAML 파일 (`rag_content/concepts/five_element_*.yaml`)
- [ ] knowledge_assets 테이블 5건 insert
- [ ] 홈 학습 프리뷰 카드 컴포넌트 (Phase 1 MVP)
- [ ] 개념 상세 페이지 (더보기 탭 내 링크)
- [ ] Phase 3 배우기 탭 플래그 (feature flag로 관리)

**ADR-028 제약**: 학습 카드 시리즈 정식 노출은 Phase 2 승인 후. 사용자 승인(CLAUDE.md §1.1) 없이 MVP 범위 확장 금지.
