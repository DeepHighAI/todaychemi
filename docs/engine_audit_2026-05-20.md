# 핵심 분석 엔진 감사 리포트 (2026-05-20)

> **두괄식 결론**: 4개 영역 중 **만세력·점수 엔진은 업계 표준 이상** (G0 100/100 + ADR-035 결정형 1000회 검증), **RAG와 LLM 프롬프트는 즉시 보강 필요** (명리 specialist 검수 0건 + 4단 모델 매핑 명세-구현 갭). 프로젝트 전용 서브에이전트 5종을 설계해 향후 회귀를 자동화한다.

작성자: 엔진 감사 세션 / 검증 깊이: 중간 (Explore 에이전트 4개 병렬 + 2025+ 외부 크로스체크)
범위: `src/lib/kasi`, `src/lib/scoring`, `src/lib/rag`, `src/lib/llm`, `src/lib/hapcard`, `src/lib/whatif`, `src/lib/today`, `src/lib/glossary`, `prompts/`, `rag_content/` (총 약 3,200 LOC + 테스트 60+ 파일)

---

## 0. 요약 매트릭스

| 영역 | 현재 상태 | 업계 표준(2025) 대비 | 즉시 조치 필요 | 비고 |
|---|---|---|---|---|
| 만세력 (KASI + ssaju) | ✅ G0 100/100 PASS | **이상** (90%+ baseline) | ❌ 없음 | 1968년 이전·해외 출생만 미커버 |
| 사주 점수 (scoring) | ✅ ADR-035 100% 결정형 | **부합** (LLM 격리 모범) | ❌ 없음 | TBD-S2 모드별 십신축 LLM-judge 미수행 |
| RAG (고전 20건) | ⚠️ 기술은 견고, 검수 미수행 | **갭** (17~34% 환각 위험) | ✅ **명리 specialist 검수** | 20건 전부 `approved_ai_pending_human` |
| LLM 프롬프트 엔진 | ⚠️ PII 차단 완벽, 모델 라우팅 갭 | **갭** (canary/shadow 미구현) | ✅ **4단 모델 매핑 구현** | DEFAULT_LLM_MODEL='gpt-5-mini' 단일 운영 중 |

---

## 1. 만세력 레이어 (KASI + ssaju + normalize)

### 1.1 현황
- **G0 게이트 100/100 PASS** (normal 50/50, boundary 30/30, edge 20/20). KASI vs ssaju 일치율 검증 완료.
- 5파일 코어 스택 (`normalize.ts:134줄` 중심): KASI = day_pillar 진본, ssaju = 年/月/時柱 source (절기 기준), manseryeok-js = 보조 cross-validator.
- ADR-037 §1.1 결정: 야자시 = 조자시 통합학파 (constants.ts에서 결정).
- 단위 테스트 40+개 (~95% 경로 커버), 픽스처 100건 (단위 테스트는 25%만 변환).

### 1.2 갭 (Non-blocking)
| # | 갭 | 영향 |
|---|---|---|
| K1 | 해외 출생 timezone 미적용 — 모두 KST 가정 | Phase 3 SEA 진출 시 정확도 0% |
| K2 | DST/1908-1988 한국 표준시 변경 미반영 | edge 픽스처는 있으나 단위 테스트 부재 |
| K3 | 100건 픽스처 boundary 30 케이스 단위 테스트화 누락 | 회귀 감지 지연 |

### 1.3 권장 (P1/P2)
- **P1**: BirthInput에 `timezone_offset` 필드 추가 (Phase 3 진입 게이트).
- **P1**: 1908-1988 한국 표준시 historical offset 하드코딩 + 거부 로직.
- **P2**: `tests/fixtures/boundary_30.json` → 30개 it() 파라미터화.

---

## 2. 사주 점수 엔진 (scoring + hapcard builder)

### 2.1 현황
- **ADR-035 100% 준수**: scoring/ 10개 모듈 전체에서 LLM 호출·Math.random·Date.now 사용 0건.
- `tests/lib/scoring/determinism.test.ts`: 동일 입력 1000회 호출 → `unique set size === 1` 검증.
- `final.ts:27` 가중 합산식: `w.hap * sHap + w.sipsin * sSipsin + w.ohaeng * sOhaeng + yunseAdj` (clamp [0,100]).
- `modeWeights.ts`: 6모드 가중치 합 = 1.0 검증.
- `yunseAdjustment.ts`: 4레이어(대운 0.40·세운 0.30·월운 0.20·일운 0.10) + 모드별 민감도(일합 1.00 ~ 오래합 0.70).
- 합·형·충·해 산정 (`hapChungHyungHae.ts:216`): 중복합 보너스 +5, 합 우선 1.2x 가중.
- hapcard builder (`builder.ts:61-66`): 점수 먼저 산출 → LLM 호출 순서 강제 (LLM이 점수 수정 불가능).

### 2.2 갭 (Non-blocking, 모두 TBD 추적 중)
| # | 갭 | TBD ID |
|---|---|---|
| S1 | yunseAdjustment 형·파·해·삼합·반합 단순화 | TBD-S1 (사용자 베타 100쌍 모니터링) |
| S2 | 모드별 십신축 매핑 LLM-judge ≥ 3.5 미수행 | TBD-S2 (G2 베타 전 필수) |
| S3 | 오행 부족·과다 임계값(20%/30%) 하드코딩 | TBD-S3 (1000건 분포 분석 후 조정) |
| S4 | changeScore null 처리 — 첫 hapcard도 변화도 0 | (개선안) snapshot null vs 진짜 0 구분 |
| S5 | whatif builder grounding 재시도 1회 (hapcard는 2회) | (정책) 통일 권장 |

### 2.3 권장 (P2/P3)
- **P2**: changeScore null 구분 + role 평균 fallback 로직.
- **P2**: whatif builder 재시도 2회로 통일 + 실패 로깅.
- **P3**: TBD-S2 LLM-judge 자동화 — 서브에이전트 `scoring-determinism-checker`가 정기 검증.

---

## 3. RAG 고전 데이터

### 3.1 현황 (강점)
- **기술 인프라 견고**: OpenAI `text-embedding-3-small` 1536차원 + Supabase pgvector + `match_classics` RPC. `embeddings.ts:14`, `classics.ts:40-58`.
- **Grounding 검증은 패스스루 아님**: `grounding-validator.ts:19-56`에서 LLM 출력 인용을 RAG 히트와 `===` 비교 (공백도 감지). RAG_CLASSIC_MISS / CLASSIC_TEXT_MISMATCH 에러 코드로 차단.
- 테스트 커버 우수: grounding 9건, classics 10건, embeddings 6건, citation-schema 5건, query-text 8건.
- YAML 스키마 5권 × 4건 완벽 일관성.

### 3.2 **❗ 즉시 조치 필요 - 명리 specialist 검수 0건**
- **20건 전부 `review_status: approved_ai_pending_human`** (AI만 2중 교차, 사람 검수 미수행).
- ADR-018 §7.2 게이트 2(커뮤니티 크라우드 3~5명) **미진입**.
- Stanford 2025 연구: legal RAG도 17~34% 환각 발생. 명리 도메인은 더 높을 가능성.
- 출시 전 처리 못 하면 ADR-018 위반 + 사용자 신뢰 리스크.

### 3.3 모드별 커버리지 불균형
| 모드 | 자산 건수 | 평가 |
|---|---|---|
| 오래합 | 12 | ⚠️ 과포화 |
| 일합 | 8 | ✅ |
| 돈합 | 6 | ✅ |
| 친구합 | 5 | ⚠️ 보충 권장 |
| 첫합 | 4 | ⚠️ 보충 권장 |
| 썸합 | 3 | ❌ 저투 |

### 3.4 권장 (P0/P1)
- **P0**: 명리 커뮤니티(네이버 카페·디스코드) 3-5명 섭외 → Google Form 1~5점 평가 → 평점 ≥ 3.5 항목 `approved_ai_and_crowd` 승격. 1주 내 완료.
- **P0**: 플랜 B (게이트 2 7일 무응답 시): $30-50/건 × 20 = $600-1000 유료 감수. 정해진 예산 §1.1 결정 필요.
- **P1**: 썸합 +3건, 친구합 +3건, 첫합 +3건 추가 시드 (Phase 1.1).
- **P2**: 시드 스크립트 임베딩 재생성 옵션 — 자산 수정 시 자동 reembedding.

---

## 4. LLM 프롬프트 엔진

### 4.1 현황 (강점)
- **ZDR/PII 차단 완벽**: `payload.ts:62-73`에서 화이트리스트 기반 5필드+gender 차단. `openai.ts:82-86`의 `PII_GUARD_VIOLATION` 검증으로 우회 불가능.
- **Prompt rollback 안전**: DB `(prompt_name, status='active')` Unique 제약 + `seed-prompts.ts` 기존 active→rolled_back 후 신규→active 배포.
- v0.7 → v0.8 active 운영 중 (Phase B 한자 노출 제거 완료).
- banned_phrases v1.0: 6 카테고리 40+ 표현 출력 검사.
- 한자 Option C(경고+통과) 정책 + UI `convertHanja()` 최종 후처리.

### 4.2 **❗ 즉시 조치 필요 - 4단 모델 매핑 명세-구현 갭**
- **명세**: GPT-5(핵심 hapcard) / GPT-5(딥합) / GPT-5 mini(오늘합) / Claude(fallback) 4단 라우팅 (`tech_stack.md`).
- **실제**: `openai.ts:79` `DEFAULT_LLM_MODEL = 'gpt-5-mini'` 단일 운영. mode → model 라우팅 로직 미존재.
- **영향**: hapcard 9~13섹션이 mini로 생성되어 품질·길이 부족 가능. 딥합 미출시지만 출시 시 결정 필요.

### 4.3 갭 - 운영 도구 미흡 (2025 업계 표준 대비)
- Langfuse/PromptLayer 같은 prompt registry 미사용 — DB 직접 관리.
- **canary rollout 미구현**: 신규 prompt 배포 시 100% 즉시 적용. 2025 표준은 5%→25%→100%.
- **shadow testing 미구현**: 신규 vs 기존 prompt 병렬 호출 후 비교 평가 없음.
- LLM CI 자동 검증 (PR 단위 PII/banned/grounding 회귀 테스트) 부분 구현.

### 4.4 권장 (P0/P1/P2)
- **P0**: mode → model 라우팅 함수 (`src/lib/llm/model-router.ts`) 신규 — 1주 작업, §1.1 모델 매핑 결정 후 진행.
- **P1**: banned-phrases 자모 분리 우회 방어 (정규식 강화).
- **P1**: prompt canary rollout — `prompt_versions` 테이블에 `traffic_percentage` 컬럼 추가 + route handler에서 weighted sampling.
- **P2**: PII CI 자동 검증 (매 PR `pnpm test -- llm/payload`).
- **P2**: OpenAI 5xx → Claude fallback circuit breaker.

---

## 5. 프로젝트 전용 서브에이전트 5종 설계

> **배포 방식**: `.claude/agents/<name>.md` (현재 디렉토리 부재 → 본 세션 다음 단계 §1.1 승인 후 생성).
> 2025 best practice 준수: 1 subagent = 1 task, least privilege tool 권한, Read/Grep 위주, Sonnet 모델로 비용 최적화.

### 5.1 `manseryeok-validator`
| | |
|---|---|
| **목적** | KASI vs ssaju vs manseryeok-js 3소스 cross-validation 결과를 자동 검증. G0 게이트 회귀 감지. |
| **트리거** | "만세력 검증", "KASI vs ssaju 일치율", "G0 게이트 재실행", normalize.ts 변경 후 |
| **도구 권한** | Read, Grep, Bash (verify-kasi-vs-ssaju.ts, verify-ssaju-accuracy.ts 실행만) |
| **출력** | normal/boundary/edge 카테고리별 일치율 + 실패 케이스 인덱스 |
| **모델** | Sonnet (도구 호출 위주) |

### 5.2 `scoring-determinism-checker`
| | |
|---|---|
| **목적** | scoring/ 모듈에 LLM 호출·Math.random·Date.now 도입 시 즉시 감지. ADR-035 회귀 차단. |
| **트리거** | scoring/* 또는 hapcard/builder.ts 변경 PR, "결정형 검증", "ADR-035 회귀" |
| **도구 권한** | Read, Grep, Bash (determinism.test.ts 1000회 실행) |
| **출력** | (a) LLM/난수/시간 import 위반 라인 목록 (b) 1000회 실행 unique size |
| **모델** | Sonnet |

### 5.3 `rag-classics-curator`
| | |
|---|---|
| **목적** | YAML 20건 스키마/품질/모드 커버리지 자동 감사. 새 자산 추가 시 review_status 단계 진행 자동화. |
| **트리거** | rag_content/classics/ 변경, "고전 자산 추가", "모드 커버리지 확인", "review_status 승격" |
| **도구 권한** | Read, Glob, Grep, Edit (review_status 필드 한정), WebSearch (원문 출전 확인) |
| **출력** | 모드별 커버리지 표 + 누락 토픽 + topic_tags 정규화 제안 |
| **모델** | Sonnet (Opus도 가능, 도메인 검토 시) |

### 5.4 `prompt-version-auditor`
| | |
|---|---|
| **목적** | prompts/system/*.md 변경 시 banned_phrases 회귀·PII 누출·grounding 강제 지시 누락 검사. v0.x → v0.x+1 승격 게이트. |
| **트리거** | prompts/system/ 또는 prompts/banned_phrases_catalog.yaml 변경, "프롬프트 검토", "v0.x 승격" |
| **도구 권한** | Read, Grep, Bash (banned-phrases.test.ts, payload.test.ts 실행) |
| **출력** | (a) 금지 표현 매칭 (b) PII placeholder 사용 여부 (c) "ONLY these asset_ids" grounding 지시 존재 여부 |
| **모델** | Sonnet |

### 5.5 `hapcard-builder-qa`
| | |
|---|---|
| **목적** | hapcard/whatif/today builder 변경 시 9~13섹션 composition lock 회귀 + cause_factors convertHanja 호출 여부 + grounding 재시도 정책 일관성 검사. |
| **트리거** | hapcard/* 또는 whatif/* 또는 today/* 변경 PR, "합카드 QA", "섹션 lock 검증" |
| **도구 권한** | Read, Grep, Bash (builder.test.ts 전체 실행) |
| **출력** | 섹션 카운트 + Hanja regex 매칭 + 재시도 횟수 + 실패 케이스 |
| **모델** | Sonnet |

---

## 6. 우선순위 매트릭스 (실행 권장 순서)

| 우선순위 | 항목 | 담당 영역 | 예상 공수 | §1.1 결정 필요 |
|---|---|---|---|---|
| **P0-1** | 명리 specialist 커뮤니티 검수 시작 | RAG | 1주 (외부 협업) | 예산 (유료 감수 fallback) |
| **P0-2** | 4단 모델 매핑 구현 (`model-router.ts`) | LLM | 1주 | mode→model 매핑 표 확정 |
| **P1-1** | 서브에이전트 5종 `.claude/agents/` 생성 | 메타 | 1일 | 본 리포트 승인 후 |
| **P1-2** | timezone_offset BirthInput 추가 (Phase 3 게이트) | 만세력 | 3일 | Phase 3 진입 시점 |
| **P1-3** | banned-phrases 자모 분리 우회 방어 | LLM | 1일 | 없음 |
| **P1-4** | RAG 자산 +9건 (썸합 3·친구합 3·첫합 3) | RAG | 3-5일 | AI 2중 생성 후 검수 자원 결정 |
| **P2-1** | prompt canary rollout (`traffic_percentage`) | LLM | 3일 | 카나리 정책 (5%→25%→100%) |
| **P2-2** | changeScore null 구분 + role fallback | scoring | 1일 | 없음 |
| **P2-3** | whatif 재시도 2회로 통일 | scoring | 0.5일 | 없음 |
| **P2-4** | TBD-S2 LLM-judge 자동화 | scoring | 3일 (서브에이전트 활용) | G2 베타 전 필수 |
| **P3** | OpenAI→Claude circuit breaker | LLM | 2일 | 없음 |

---

## 7. 본 리포트의 제약과 미해결 항목

- **검증 한계**: Explore 에이전트는 파일 일부를 표본 읽음. 1단계 표면 스캔 + 핵심 파일 내부 + 테스트 인벤토리까지 진행. 모든 LLM 프롬프트 라인별 검토는 미수행 (심층 감사 별도 세션 필요).
- **외부 자료**: 2025+ 자료만 활용 (Stanford legal RAG 환각률, KASI Open API 정확도 90%+, Langfuse/PromptLayer canary 표준). 한국 사주 RAG 운영 사례 공개 자료 부재 — Anthropic 본문 SaaS 비공개 운영 추정.
- **§1.1 결정 대기 항목** (본 리포트 채택 시 별도 세션):
  1. mode → model 매핑표 (hapcard·deep·daily·whatif·replay 각 모델)
  2. 명리 specialist 감수 예산 ($600-1000 유료 fallback 여부)
  3. 서브에이전트 5종 `.claude/agents/` 즉시 생성 여부
  4. prompt canary 5%→25%→100% 정책 채택 여부

---

## 8. 다음 단계 제안

1. 본 리포트 검토 후 §6 우선순위 매트릭스 확정 (§1.1 4가지 결정).
2. P0-1, P0-2 동시 착수 — 외부 협업(RAG)과 내부 코드(LLM)는 독립적.
3. 서브에이전트 5종 생성 (P1-1) — 이후 모든 PR이 자동 회귀 검증.
4. Phase 3 진입 결정 전 P1-2 (timezone) 완료.

---

## 출처 (2025+)

- [Prompt versioning and its best practices 2025 — Maxim AI](https://www.getmaxim.ai/articles/prompt-versioning-and-its-best-practices-2025/)
- [Prompt Versioning, Testing, and CI/CD — Medium, Dec 2025](https://medium.com/@mrhotfix/prompt-versioning-testing-and-ci-cd-why-your-llm-system-is-more-fragile-than-you-think-000441e57f61)
- [The 5 best prompt versioning tools in 2025 — Braintrust](https://www.braintrust.dev/articles/best-prompt-versioning-tools-2025)
- [AI Hallucination and Grounding | Citation Actually Works — ClarityArc](https://www.clarityarc.com/insights/ai-hallucination-grounding-citation)
- [Legal RAG Hallucinations — Stanford 2025](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf)
- [RAG Evaluation: A Complete Guide for 2025 — Maxim AI](https://www.getmaxim.ai/articles/rag-evaluation-a-complete-guide-for-2025/)
- [Best practices for Claude Code subagents — PubNub](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/)
- [Claude Code Sub-Agents: Parallel vs Sequential Patterns](https://claudefa.st/blog/guide/agents/sub-agent-best-progress)
- [KASI Open API — 한국천문연구원](https://astro.kasi.re.kr/information/pageView/31)
- [한국천문연구원_음양력 정보 — 공공데이터포털](https://www.data.go.kr/data/15012679/openapi.do)
