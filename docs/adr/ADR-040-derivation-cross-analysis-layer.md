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
   *Accepted side channel (user decision 2026-06-12):* `LlmYunse.daeun.current`
   carries `{age, year}` from which a birth year is derivable (`year − age` ±1).
   This pre-existing Phase Y2 field is **explicitly accepted** — assessed as
   carrying no legal/PII risk (birth year alone is not among the §5 forbidden
   fields; only the original `birth_date` is). The band-only guarantee therefore
   applies to this layer's own outputs; the payload as a whole intentionally
   exposes the daeun year for interpretation quality.
5. **Persistence:** `derived` persists inside `chart_core` jsonb (v3);
   `cross_analysis` is computed per request and **never persisted** — cached only as
   part of the LLM result row it contributed to.
   **Cache-coupling rule:** LLM result cache keys do NOT include
   `CROSS_ANALYSIS_VERSION`/`derived_version`. Any future bump of either MUST be
   accompanied by a prompt version bump (or theory version bump) — that is the
   cache rotation lever. A silent cross/derive algorithm change without one keeps
   serving cached interpretations built from old facts.
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

---

## Amendment — 2026-06-18: 기운 케어 (energy_food / meeting_vibe) 보조 추천층

**Status:** Accepted (brainstorming → writing-plans → 9-phase TDD).  
**Decider:** batisututu. **Spec:** `docs/superpowers/specs/2026-06-18-energy-food-date-package-design.md`.

케미카드에 **"기운 음식"(energy_food, 전 6모드)** + **"만남 분위기"(meeting_vibe, 첫합·썸합 한정)** 보조 추천 콘텐츠를 추가한다. 이 층은 ADR-040 본문 원칙(파생 결정형·점수 무개입·환각 가드·§5)을 그대로 따르며 다음을 명문화한다:

1. **공통 보완 원소 = 결정형 파생.** `src/lib/saju/pair-complement.ts` 가 두 사람 `derived.ohaeng_weighted` 를 합산해 가장 약한 원소를 고른다(중화 분기 `yongsin.ts` 미러, tie-break `목화토금수`). 1000-run 결정성 의무. **점수 무개입**(ADR-035 불변). yongsin-겹침 2차 tie-break 은 명리 specialist 검수로 **연기(잠정)** — 본문 §6.7 신강약·용신 잠정과 동일 지위.
2. **오행→음식 매핑 = 잠금 자산.** `src/lib/hapcard/element-food-map.ts`(고전 오행-맛 + 큐레이션 음식 + `MEETING_VIBE_ARCHETYPE`). RAG classics 와 동일하게 **명리 specialist 검수 대상**(`review_status: ai_pending_human`).
3. **음식 선택은 서버, 문구만 LLM.** `energy_food`의 element/foods/reason 은 서버 결정형(`buildEnergyFood`). LLM 은 `energy_food.copy`(한 문장) 만 윤문한다. 출력 스키마는 optional + `.catch(undefined)` fail-soft — 누락/형식오류 시 결정형 폴백, 전체 카드 파싱 불파손.
4. **이름 제약 가드 = 폴백(throw 아님).** `validateEnergyFoodCopy` 가 LLM copy 의 실제 지명(§5)·한자(ADR-038) 위반을 검사해 위반 시 결정형 copy 로 폴백한다 — RAG `GROUNDING_FAILED` 와 달리 하드 실패하지 않는다. **banned-phrase 는 별도 경로(구현 정정 2026-06-18):** `builder.ts` 는 가드를 `bannedCatalog` 인자 없이 호출하므로 BANNED_PHRASE 분기는 builder 경로에서 비활성이며, `energy_food.copy` 의 금칙어는 다른 모든 LLM 필드와 동일하게 전역 `validateLlmText` 가 하드페일+재시도로 차단한다(누락·미차단 아님). 금칙어는 보통 카드 전반의 신호라 부분 폴백보다 카드 단위 거부가 안전. `validateEnergyFoodCopy(copy, bannedCatalog)` 시그니처·단위테스트는 직접 호출용으로 유지.
5. **§5 위치 데이터 0.** `meeting_vibe` 는 추상 분위기 아키타입만(실제 지명·상호 절대 금지) — 위치 데이터가 시스템에 존재하지 않으므로 LLM 미관여 결정형으로 생성. energy_food copy 는 지명 가드로 이중 방어.
6. **Cache-coupling(본문 §5 규칙 확장).** energy_food 는 `deriveCacheKey` 에 미포함(차트+프롬프트의 순수 함수). element-food-map **내용 변경 시 프롬프트 버전 범프 필수** — 그렇지 않으면 캐시된 카드가 옛 음식을 계속 서빙한다.
7. **롤아웃 현실.** `seed-prompts` 는 active·canary 를 **같은 본문**으로 시드한다(canary = 라우팅 검증 전용, 콘텐츠 A/B 아님). 따라서 프롬프트 v0.18 승격 시 LLM 윤문은 ~100% 노출되며(가드+폴백 보호), canary 5% 콘텐츠 게이팅은 불가. 결정형 energy_food 는 builder 주입으로 프롬프트 버전과 무관하게 100% 노출.
8. **UI = additive(ADR-016 컴포넌트 7).** ExpandPanel "기운 케어" 탭. 잠금된 1~6 컴포넌트 불변, 위에 얹음.

**스케일 caveat:** `pairComplementForCharts` 는 한 쌍 안에서 스케일 혼용을 금지한다 — 한쪽이라도 `ohaeng_weighted` 해소(derived→deriveSaju) 실패 시 양쪽을 `five_elements_counts`(표면 카운트)로 통일. weighted/표면 스케일 차이로 보완 원소가 달라질 수 있으며, 이는 잠정 산식의 일부로 문서화한다.

**Files:** `src/lib/saju/pair-complement.ts` · `src/lib/hapcard/element-food-map.ts` · `src/lib/hapcard/energy-food.ts` · `src/lib/llm/output-schema.ts`(EnergyFoodLlmSchema) · `src/types/hapcard.ts`(EnergyFood/MeetingVibe) · `src/lib/hapcard/builder.ts`(주입+가드+폴백) · `src/components/hapcard/energy-care.tsx` · `prompts/system/*.md`(v0.18/v0.19).

**§사용자 수동(deploy):** `pnpm seed:prompts` → v0.18 active / v0.19 canary 6모드. **검수 대기:** 공통 보완 원소 규칙 + element-food-map 자산(명리 specialist).
