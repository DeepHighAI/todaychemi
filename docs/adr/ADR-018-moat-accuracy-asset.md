# ADR-018: Moat — Minglijeongwhakseong Accuracy Asset

**Date:** 2026-04-30  
**Status:** Accepted (Amended 2026-05-11)  
**Deciders:** batisututu  

## Decision

모트 = 명리 정확성 자산:
- KASI Agreement (천체력 기반 진본 검증)
- ssaju + manseryeok-js 다중 검증
- `prompt_version` 카나리 관리
- `banned_phrases` 운세 단정 표현 필터
- 고전 RAG 크라우드 검수 (명리 specialist)

고전 인용 (`classic_citation`) 은 RAG/DB에 verbatim 저장하여 원문 정확성을 보장한다.

## Amendment — 2026-05-11 (Phase B)

**Original rule:** "고전 인용 verbatim" — classical citations must be displayed exactly as stored.

**Amendment:** The verbatim rule applies to the **RAG/DB storage layer only**. The **UI display layer** may convert Hanja to Korean for accessibility. Specifically:
- `builder.ts` maps `classic_citation` fields using `stripHanjaInParens()` + `translateChapter()` + `original_reading`.
- `rag_content/classics/*.yaml` originals are NOT modified.
- This amendment was decided in Phase B (ADR-038) to remove Hanja from user-facing text.
