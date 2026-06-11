# ADR-040: Saju Derivation + Cross-Analysis Layer — LLM Evidence Only

**Date:** 2026-06-11  
**Status:** Accepted  
**Deciders:** batisututu  

## Context

Before this layer, LLM interpretation evidence was thin: sipsin was only computed
one-way (self day-stem vs relation's 4 stems, scoring-internal), and jijanggan,
sinkang/yakang judgment, yongsin candidates, palace (gungwi) attribution, and
bidirectional yunse cross facts did not exist anywhere. Prompt v0.13 even told the
LLM to *infer sipsin placements by itself* from raw ganji — a hallucination surface.

This round adds two deterministic pure-function layers:

1. **Per-person derivation** (`src/lib/saju/derive.ts` → `SajuDerived`, embedded in
   `chart_core.derived`, theory `v2`→`v3`): full 8-char sipsin expansion, jijanggan
   with integer weights (정기10/중기5/여기3), 억부 simple-score sinkang, yongsin/희신
   candidates, yinyang balance, tti, ilju 60-gapja key.
2. **Relation cross-analysis** (`src/lib/saju/cross.ts` → `CrossAnalysis`,
   `cross-v1`): bidirectional sipsin cross matrix (stems + branch 정기), palace
   attribution of hap/chung/hyung/pa/hae events, bidirectional yunse cross
   (hap/chung only), ilgan pair polarity, age-difference band.

## Decision

1. **LLM evidence only — zero score participation.** Neither `derived` nor
   `cross_analysis` feeds `computeFinalScore` or any scoring component. The score
   pipeline (ADR-035) is untouched by this layer. The C1 yunse-encoding bugfix that
   shipped in the same round (`SCORING_VERSION 1→2`) is an independent bugfix, not
   part of this layer.
2. **Deterministic pure functions.** No `Date.now`/`Math.random`/LLM calls; integer
   weight scales; fixed array ordering; locked salient template sentences. 1000-run
   determinism tests are mandatory for `deriveSaju` and `computeCrossAnalysis`.
3. **Hallucination guard in prompts.** Every prompt that receives this data carries
   the hard clause "제공 필드 외 단정 금지": sipsin/jijanggan/sinkang/yongsin/palace
   claims must come only from payload fields; absent topic ⇒ no mention.
4. **PII boundary — age band only.** Birth years are server-internal inputs; only
   `age_gap.band` ('동갑'|'1-3'|'4-6'|'7+') and `relation_is` ('연상'|'연하'|'동갑')
   strings enter any output or LLM payload. Key naming avoids forbidden PII key
   segments (e.g. `palace_meaning`, never `palace_name`). LLM projection
   (`projectDerivedForLlm`) drops the sinkang numeric score — verdict string only.
5. **Persistence:** `derived` persists inside `chart_core` jsonb (v3);
   `cross_analysis` is computed per request and **never persisted** — cached only as
   part of the LLM result row it contributed to.
6. **Compatibility:** `ChartCore.derived` is optional (legacy v2 rows);
   `resolveDerivedForLlm` recomputes on the fly for v2 rows and omits with a
   `[DERIVED_INVALID]` warn on validation failure (fail-open — interpretation
   quality degrades, never a 500).

## Alternatives Considered

| Option | Rejected Because |
|---|---|
| Feed derived/cross into the score formula | Violates ADR-035 score lock; would force SCORING_VERSION churn and specialist re-review of the whole formula |
| Separate DB table for derived | Doubles writes + join on every read; chart_core jsonb + version bump is the established single cache lever |
| Persist cross_analysis | Pairwise rows explode (n×m), invalidation is hard; computation is cheap and deterministic |
| Let the LLM keep inferring sipsin from raw ganji | Confirmed hallucination surface — the layer exists to remove it |

## Consequences

**Positive:** richer, citable interpretation evidence in 케미카드/오늘 케미/또 다른 나;
hallucination surface shrinks (prompts now reference provided facts); v3 bump
naturally rotates all chart caches.

**Negative / accepted:** LLM payload grows (~+1,900 chars per hapcard — monitor via
`llm_cost_tracking`); 신강약 산식·지장간 가중·용신 룰은 학파 단순화로 **명리 specialist
검수 전 잠정** (checklist: `docs/specs/manseryeok_theory.md` §6.7); age band has a
documented ±1 error near lunar new year (solar-year subtraction).

**References:** `docs/specs/manseryeok_theory.md` §6 (algorithms + checklist),
`compatibility_scoring_spec.md` (non-interference cross-ref), prompts v0.15 line.
