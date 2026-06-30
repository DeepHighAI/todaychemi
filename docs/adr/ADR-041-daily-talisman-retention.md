# ADR-041: Daily Talisman Retention Ritual (오늘의 부적)

**Date:** 2026-06-30
**Status:** Accepted
**Deciders:** batisututu

## Context

A home-screen retention feature ("오늘의 액땜 부적") was developed in the miniapp
(Codex session) to lift 잔존율/retention: the today hero shows a daily warding-talisman
ritual where the user traces a single seal glyph on a canvas and "seals" it. It was
greenfield — no prior ADR/PRD/spec. Reviewed and hardened 2026-06-30 (§1.1 decisions
D1–D4 + an ADR-038 carve-out decision).

The ritual is purely client-side (localStorage), with no backend route, no DB
migration, no LLM call, and no PII.

## Decision

1. **Supplementary, never above the core funnel (ADR-010).** The ritual is supplementary
   content. On the today hero it renders **below** the core activation CTA (relation
   registration / G-10 block) so that 0-relation users see the single-core funnel first.
   It must never sit above the relation-registration / 케미카드 entry point.

2. **Myeongri basis = derived yongsin (ADR-018 / ADR-040).** The daily element is
   `chart_core.derived.yongsin.primary` (용신) — the same basis the hapcard LLM already
   uses, so this introduces **no new myeongri claim**. Fallback chain: yongsin →
   min-count element (legacy v2 charts lacking `derived`) → `null` (render nothing).
   The 용신/신강약 rules inherit ADR-040's provisional status (pending 명리 specialist
   review); this feature adds no new specialist burden.

3. **Deterministic, score-free (ADR-035 spirit).** The builder is a pure deterministic
   function (FNV-1a seed; no `Math.random`/`Date.now` in element/variant selection). The
   feature carries no score and does not touch the scoring pipeline.

4. **PII / ZDR (§5).** Client-only via `localStorage`. No LLM payload. Retention
   analytics (decision 7) carries only `{element, theme}` — both chart-derived, non-PII —
   and is sent to Toss native logging, not to any LLM provider, so ZDR is not implicated.

5. **ADR-038 carve-out — accepted (user decision 2026-06-30).** The ritual deliberately
   displays a single seal glyph (한자) as its core "따라쓰기" interaction, always paired
   with its Korean reading (e.g. `伸 · 펴기`). This is an **accepted exception** to
   ADR-038. ADR-038 governs hanja leaking into 명리 interpretation prose (sipsin/sinsal
   terms) and its `convertHanja()` safety-net; a labelled decorative seal glyph in a
   ritual is out of that scope. The glyphs are generic virtue/action characters
   (伸/和/安/守/清 …), not classical 명리 terms, and `convertHanja()` is intentionally
   **not** applied to them. The surrounding copy (gapLabel/actionText) remains pure Korean.

6. **Accessibility — non-pointer completion path.** Completion must be reachable without a
   pointer: the canvas is focusable and accepts Enter/Space/Arrow to advance the ritual
   (keyboard/switch/AT users can complete and seal).

7. **Retention analytics via Apps-in-Toss `eventLog`.** The miniapp has no GA. Events
   `talisman_view` / `talisman_start` / `talisman_complete` are sent through the
   Apps-in-Toss SDK (`eventLog`, re-exported from `@apps-in-toss/web-framework`),
   best-effort and failure-harmless (no UI impact outside Toss).

## Consequences

- The displayed element is natal-constant (용신 does not change daily); daily freshness
  comes from date-seeded variant rotation (오행별 4 variants) **and a consecutive-day
  streak** (`advanceStreak`, `localStorage` key `…:streak:v1`, deterministic: yesterday→+1,
  gap→reset to 1, same-day→idempotent; a "🔥 N일 연속" badge shows in the completed state at
  ≥2 days). True per-day element variation (일운 reflection) and cross-device streak sync
  are deferred (user decision 2026-06-30: streak only).
- Persistence is per-device (`localStorage`, key `todaychemi:daily-talisman:v2:...`).
- Implementation: `miniapp/src/lib/today/daily-talisman.ts`,
  `miniapp/src/components/today/daily-talisman-ritual.tsx`,
  `miniapp/src/lib/analytics/ait-analytics.ts`,
  `miniapp/src/types/chart.ts` (`SajuDerived`).
