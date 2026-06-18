# 케미카드 보조 콘텐츠 — "기운 음식" + 첫/썸 데이트 패키지

- **상태**: Design approved (brainstorming) — 구현 계획(writing-plans) 대기
- **작성일**: 2026-06-18
- **관련 ADR**: ADR-010(핵심 위계) · ADR-015(근거 표시) · ADR-016(카드 컴포넌트 잠금, additive) · ADR-018(명리 모트) · ADR-035(점수 결정형) · ADR-038(한자) · ADR-040(파생/교차층) · §5 PII/ZDR
- **본 문서는 설계 단일 진실이며, 구현 시 §12 변경 매트릭스에 따라 FGI/PRD/프롬프트/ADR을 동시 갱신한다.**

---

## 1. Context (왜)

각 인연(케미카드)에 "더 많고 실용적인" 콘텐츠를 더해 체감 가치를 높이려는 기획. 원안은 6모드별 추천 음식/힐링장소/추천 데이트/조심할 행동/실행할 것 추가였으나, 레드팀 검토(출력 스키마·명리 grounding·PII·프롬프트 3중 코드 탐색) 결과:

1. **조언·주의·실행은 이미 6모드 전부에 존재** — `actions`(4) + `why_cards`(강점+조심) + hero 코칭("좋아!/조심!/이렇게 해봐!") + `buildSpecificAction()` 테마 라우팅(돈/첫만남/오래/속도/끌림). → "조심할 행동/실행할 것/데이트 행동"은 신규 섹션이 아니라 **기존 강화**로 흡수.
2. **실제 장소 추천 불가** — 위치 데이터 0건(`birth_place`는 §5 금지 + DB 미저장, 페이로드 전무). LLM 환각 + 위치추론 PII 인상 + grounding validator가 자유텍스트 미검증. → **실제 장소·상호·지역명 절대 금지**, 추상 기운 분위기만 허용.
3. **"추천 음식"만 새롭고·차별적·근거화 가능** — 단 오행→음식 매핑이 코드에 0건이라 신설 필요.

**사용자 확정(brainstorming):**
- 방향 = 음식(공통) + 첫/썸 데이트 패키지
- 음식 기준 = **둘의 공통 보완 원소**("함께 먹으면 좋은 음식" 1세트)
- 생성 = **결정형 매핑 + LLM 윤문**(음식 선택은 결정형, 문구만 LLM)

**산출물:** 명리 근거를 동반한 "두 사람 기운 보완 음식" 공통 섹션 + 첫/썸 한정 "만남 분위기(추상)" + 첫/썸 데이트형 actions.

---

## 2. Scope

**In**
- 결정형 "공통 보완 원소" 산출 모듈 + 오행→음식 매핑 자산(신규)
- LLM 윤문 음식 라인(이름은 결정형 목록으로 제약) — 케미카드 6모드 공통
- 첫합/썸합 한정: 추상 "만남 분위기"(보완 원소 아키타입) + 데이트형 actions 강화(프롬프트)
- 신규 additive UI 컴포넌트(ADR-016 컴포넌트 7)

**Out (명시적 비채택)**
- 실제 장소·상호·지역 추천 (PII/환각)
- 일/친구/돈/오래 모드용 신규 섹션 (기존 actions/why_cards 강화로 대체)
- 음식 외 신규 "조심할 행동/실행할 것" 별도 섹션 (기존과 중복)

---

## 3. Architecture

### 3.1 결정형 레이어 (서버, 토큰/지연/환각 0 — ADR-035 패턴)

**공통 보완 원소** — 신규 `src/lib/saju/pair-complement.ts` (cross.ts 비대화 방지, role-analysis/ohaeng-interpretation 결정형 패턴 차용):
- 입력: self + relation 각각의 `derived.ohaeng_weighted`(ADR-040 파생층, `src/types/chart.ts`).
- 규칙(잠정): 두 분포를 합산해 **가장 약한 원소** = 둘 다 보완되는 기운. 동률 시 `derived.yongsin` 겹침으로 tie-break, 그래도 동률이면 상생 우선순위 고정.
- 100% 결정형(LLM/Date/random 없음). 1000회 동일 입력 = 동일 출력 테스트(ADR-040 의무).
- **명리 검수 전 잠정** — ADR-040 §6.7 "신강약·용신 룰 잠정"과 동일 지위.

**오행→음식 매핑 자산** — 신규 `src/lib/hapcard/element-food-map.ts`(구현 정정: `saju/`→`hapcard/`. `energy-food.ts` 빌더 헬퍼도 `src/lib/hapcard/`. `pair-complement.ts` 만 `src/lib/saju/`):
- 고전 오행-맛: 목=신맛 / 화=쓴맛 / 토=단맛 / 금=매운맛 / 수=짠맛.
- 맛 → 큐레이션된 한국 친화 식재료·음식류(원소당 소수 항목).
- 정적 const(잠금 자산). RAG classics처럼 명리 specialist `review_status` 검수 대상.

**만남 분위기 아키타입**(첫/썸) — 보완 원소 → 추상 분위기 문자열(예: 水→"물가·잔잔한 공간", 火→"햇살·활기찬 곳"). 결정형, **실제 장소명 절대 미생성**.

### 3.2 LLM 윤문 레이어 (이름 제약 + 가드)

- 결정형 음식/원소/분위기를 **grounded 입력**으로 메인 케미카드 프롬프트에 주입.
- LLM은 신규 출력 필드 `energy_food`(전 모드) + `meeting_vibe`(첫/썸 optional)에 **문구만** 작성. 음식명·원소·분위기 값은 제공된 결정형 값에서만.
- **이름 제약 가드**(레드팀 핵심 보완 — 기존 validator는 classic_citation만 검증): 후처리에서 `energy_food`가 결정형 음식 목록 밖 항목을 도입하면 차단 → 1회 재시도 → 실패 시 **결정형 템플릿 폴백**(LLM 없이 고정 문구). `src/lib/rag/grounding-validator.ts` 확장 또는 신규 post-process 모듈. 기존 `banned-phrases`(특히 health_medical "병이 낫는다" 류) 재사용.
- **프롬프트 버전 범프 → v0.18 active / v0.19 canary**(구현 시점 정정: 신규 본문을 v0.18 active 로 승격, v0.18 옛 canary 충돌 회피). 6모드 + 첫/썸 프롬프트에 출력 필드/규칙 추가.
- **트레이드오프(확정)**: 메인 호출 통합 → 케미카드 캐시 1회 재생성(gpt-5). 런치 기능의 정상 비용이며 신규 카드부터 자동 포함. *기각 대안*: 별도 lazy 라우트(캐시 무효화 0이나 별도 LLM 호출 + 보이스 분리) — 일관성·단순성 위해 미채택.

### 3.3 UI (ADR-016 additive, ADR-010 보조 위계)

- 신규 컴포넌트 `src/components/hapcard/energy-care.tsx`("기운 케어") — 전 모드 공통, **음식 + 명리 근거 상시 표시**("왜 = 둘의 공통 보완 기운 水", ADR-015).
- 배치(확정 기본값): `HapcardView.tsx` ExpandPanel에 신규 탭 "기운 케어" 추가(현 탭: summary/ohaeng/evidence/area/flow) — 최소 침습 additive(컴포넌트 7). design-review에서 hero 하단 노출 등 조정 가능.
- 첫/썸: 동일 컴포넌트에 `meeting_vibe` 라인 추가 렌더(모드 게이트, 신규 컴포넌트 추가 최소화).
- 데이트 actions: 첫/썸 프롬프트의 action 가이드 강화(이미 "카페·산책" 지향) — 신규 컴포넌트 없음.
- i18n: `messages/ko.json` `hapcard.energyCare.*` 신규.

### 3.4 Data flow

```
self.derived.ohaeng_weighted + relation.derived.ohaeng_weighted
  → pair-complement(공통 보완 원소)
  → element-food-map(음식 목록) + meeting-vibe(첫/썸 아키타입)
  → builder.ts: grounded 입력으로 프롬프트 주입
  → LLM: energy_food / meeting_vibe 윤문
  → 이름 제약 검증(실패→재시도→결정형 폴백)
  → output-schema(신규 optional 필드) → HapcardResult.content
  → HapcardView "기운 케어" 탭 렌더(근거 동반)
```

---

## 4. 명리 grounding & 가드 (비협상 ADR 준수)

| ADR/규칙 | 준수 방식 |
|---|---|
| ADR-015 | 음식 옆 명리 근거(공통 보완 원소) 상시 노출 |
| ADR-018 | 음식·분위기 전부 `derived` 파생 → 모트 강화, 일반 운세화 방지 |
| ADR-035 | 점수 무개입(서술 전용), 결정형 선택 |
| ADR-038 | `convertHanja()` safety-net |
| §5 PII/ZDR | chart 파생만 → 위치·PII 0, 페이로드 불변 |
| ADR-002 | 자유채팅 아님, 구조화 필드 |
| ADR-010 | 보조 위계(additive 탭), 핵심 해석 비가림 |

---

## 5. 변경 매트릭스 (§1.1 / §12)

§1.1 결정 사항(6모드 콘텐츠 확장 + ADR-016 추가 컴포넌트 + 신규 명리 자산). 구현 시 동시 갱신:
- `fluttering-gathering-island.md` §4.2 + `PRD.md` §6 (모드 콘텐츠/카드 섹션)
- `prompts/system/*.md`(6모드 + 첫/썸) + 버전 범프 → `pnpm seed:prompts`
- `src/types/hapcard.ts` + `src/lib/llm/output-schema.ts`(신규 optional 필드)
- 신규 ADR 또는 **ADR-040 Amend**(보조 추천층 = derived 파생·이름 제약·위치 금지·검수 자산)
- ADR-016 additive-only 규율(1~6 위 7 얹기)

---

## 6. 명리 specialist 검수 대기 (잠정)

- 공통 보완 원소 규칙(합산 최소 원소 vs 용신 vs 통관) — 검수 전 잠정
- 오행→음식 매핑 자산 내용(맛·식재료 적정성) — `review_status` 승급 대상

---

## 7. Verification

- **Unit (Vitest)**: pair-complement 결정형 1000회, element-food-map 전수, output-schema 신규 필드, 이름 제약 가드(목록 밖 음식 차단→폴백), PII 스캔(위치 0), banned-phrases(health_medical) 회귀.
- **프롬프트**: `prompt-version-auditor`(v0.18 승급 게이트), banned-phrases 회귀 코퍼스.
- **결정형**: `scoring-determinism-checker`(점수 경로 무개입).
- **스킬(§1.2)**: `/qa` 브라우저 스모크(음식 섹션 렌더 + 근거 + 첫/썸 만남분위기) → `/codex challenge`(이름 제약 가드 적대) → `/design-review`(신규 컴포넌트).
- **게이트**: `pnpm tsc --noEmit` / `pnpm lint` / `pnpm vitest run` 그린.

---

## 8. 미해결/후속

- UI 정확 배치(탭 vs hero 하단) — design-review 확정.
- 캐시 재생성 롤아웃 — **구현 정정: seed-prompts 가 active·canary 를 같은 본문으로 시드하므로 canary 5% 콘텐츠 게이팅은 불가**(canary = ADR-008 라우팅 검증 전용, 콘텐츠 A/B 아님). v0.18 active 승격 시 신규 카드부터 energy_food 포함, LLM 윤문은 ~100% 노출되며 이름 제약 가드+결정형 폴백이 보호. 결정형 energy_food 는 builder 주입이라 프롬프트 버전과 무관하게 100% 노출.
- 명리 검수 2건은 런치 후 specialist 발주 가능(잠정 자산으로 선출시 가능, ADR-040 선례).
