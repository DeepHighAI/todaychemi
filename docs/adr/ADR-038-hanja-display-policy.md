# ADR-038: Hanja Display Policy — UI Layer Korean Conversion

**Date:** 2026-05-11  
**Status:** Accepted  
**Deciders:** batisututu  

## Context

Phase B addresses a UX barrier for minglist beginners: hapcard LLM output contained Hanja characters (漢字) that are unfamiliar to most Korean users. Examples: `자오충(子午沖)`, `인오술(寅午戌) 삼합 화국`, `재성(財星)`.

Two root causes:
1. `prompts/system/*.md` v0.7 examples used Hanja verbatim → LLM mirrored them.
2. Hapcard React components rendered LLM text without Hanja conversion.

## Decision

**Tier 2 policy** applies to LLM output fields `main_text`, `cause_factors`, `why_cards`, `actions`:
- All Hanja (漢字) are removed from direct display.
- Minglist Korean compound terms (재성, 자오충, 삼합 등) show a Korean gloss in parentheses on first occurrence: `재성(재물 기운)`, `자오충(자-오 부딪힘)`.
- Subsequent occurrences use the base Korean term only.

**UI safety-net:** `convertHanja()` (`src/lib/glossary/post-process.ts`) is applied at React render time in 4 components (body, conclusion, highlights-2up, actions). This catches any LLM non-compliance regardless of prompt version.

**ADR-018 amendment (see ADR-018):** RAG/DB storage layer retains verbatim Hanja. Only the UI display layer converts. LLM echoes RAG fields as-is; `builder.ts` applies conversion before the hapcard data structure is returned to the UI.

## Alternatives Considered

| Option | Description | Rejected Because |
|---|---|---|
| A: Keep Hanja | No change | Fails UX goal for beginners |
| B: Full removal (no gloss) | Strip all Hanja silently | Loses technical precision; domain experts lose signal |
| C: Glossary tooltip only | Use existing tooltip system | Doesn't catch all fields; evidence.tsx only |
| **D: UI layer conversion (chosen)** | RAG verbatim in DB/LLM; Korean in UI | Minimal DB impact; LLM stays accurate; user sees Korean |

## Consequences

**Positive:**
- Hapcard text zero Hanja for end users.
- RAG corpus unchanged — accuracy maintained.
- LLM cache-key includes prompt version → v0.8 prompts auto-invalidate v0.7 cache entries.

**Negative:**
- `convertHanja()` adds a minimal string processing overhead per render (negligible at ~300 chars).
- Korean glosses slightly increase text length (within 120–280 char constraint verified).

## Implementation

- `src/lib/glossary/hanja-readings.ts` — Hanja → Korean reading maps.
- `src/lib/glossary/post-process.ts` — `convertHanja()`, `stripHanjaInParens()`, `translateChapter()`.
- `src/lib/hapcard/builder.ts` + `src/lib/replay/builder.ts` — `classic_citation` UI mapping.
- `prompts/system/*.md` v0.8 — Constraints + Examples rewritten.
- `src/components/hapcard/{body,conclusion,highlights-2up,actions}.tsx` — safety-net wraps.
- `src/lib/llm/banned-phrases.ts` — `containsClassicalHanja()` validation gate.
