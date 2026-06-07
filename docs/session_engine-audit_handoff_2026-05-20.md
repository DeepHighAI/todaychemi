# 핸드오프 — 핵심 분석 엔진 감사 (2026-05-20)

> **다음 세션 시작 시 이 파일을 먼저 읽고 §3 순서로 작업 시작.**
> 직전 세션: 4영역 감사 리포트 작성 + §1.1 결정 4건 확정 완료.

---

## 1. §1.1 확정 결정 4건 (2026-05-20)

### Decision 1 — 모델 매핑 (상향 적용, 품질 우선)

다음 세션 P0-2 `src/lib/llm/model-router.ts` 구현 시 이 표를 진실 출처로 사용.

| 모드/경로 | 모델 | 이유 |
|---|---|---|
| hapcard | `gpt-5` | 9~13섹션 핵심 결과물 |
| replay | `gpt-5` | 케미 다시 맞추기 재해석 (사용자 비용 지불) |
| deep (딥합, Phase 1.5) | `gpt-5` | 4페이지 심층 리포트 |
| daily (오늘 케미) | `gpt-5-mini` | 빈도 높음, 비용 민감 |
| whatif (만약에 우리) | `gpt-5` | 시나리오 추정, hapcard 다음 품질 등급 |
| fallback | `claude-sonnet-4-6` | OpenAI 5xx/장애 시 |

`tech_stack.md` §3 갱신 의무 (§12 변경 매트릭스).

### Decision 2 — RAG 명리 specialist 감수: 커뮤니티 무료 먼저

- 즉시: 네이버 카페(명리학) + 디스코드 명리 서버에서 3-5명 섭외 (서포터즈 크레딧 제안).
- 도구: Google Form (각 건당 "번역 정확도 1-5점" + "원문 왜곡 여부" 체크박스), 20건 평가.
- 대기 7일. 무응답 시 §1.1 재결정 — 플랜 B(유료 감수 $600-1000)로 전환 여부.
- 평점 ≥ 3.5: `review_status` → `approved_ai_and_crowd` 승격. < 3.5: 재작성 후 재검수.

### Decision 3 — 서브에이전트 5종 전부 즉시 생성

`.claude/agents/` 디렉토리 신규 + 5개 .md 파일 일괄 생성. 다음 세션 P1-1 작업.

- `manseryeok-validator.md`
- `scoring-determinism-checker.md`
- `rag-classics-curator.md`
- `prompt-version-auditor.md`
- `hapcard-builder-qa.md`

각 파일 YAML frontmatter (`name`, `description`, `tools`) + 본문 (역할·트리거·도구 권한·출력 형식). 상세 설계는 `docs/engine_audit_2026-05-20.md` §5 참조.

### Decision 4 — Prompt canary rollout: 5%→25%→100% 3단계

- `prompt_versions` 테이블에 `traffic_percentage` 컬럼 추가 (P2 작업 시점).
- 각 단계 24시간 모니터링 후 승격. 총 배포 주기 3일.
- 회귀 감지 시 즉시 0%로 강제 → 기존 active 복원.
- 구현 시점: P0-1·P0-2·P1-1 완료 후 P2 진입 시.

---

## 2. 직전 세션 산출물

- 리포트: `docs/engine_audit_2026-05-20.md` (4영역 현황 + 서브에이전트 5종 설계 + 우선순위 매트릭스).
- 임시 파일: `docs/_drafts/MANSERYEOK_LAYER_ANALYSIS.md` (Explore 에이전트 원본, 참고용).
- 본 핸드오프 파일.

검증 완료: `pnpm test`/`tsc` 미실행 (코드 변경 0건, 문서만 추가).

---

## 3. 다음 세션 시작 순서 (P0-1 → P0-2 → P1-1)

### Step 1: P1-1 먼저 (서브에이전트 5종 생성) — 30분~1시간

**왜 P1-1 먼저?** 이후 P0-1·P0-2가 새로 만든 `scoring-determinism-checker`·`prompt-version-auditor`로 자동 검증되어 안전.

1. `.claude/agents/` 디렉토리 생성 (없음).
2. 5개 .md 파일 작성. 각각 spec: `docs/engine_audit_2026-05-20.md` §5.1~5.5.
3. 검증: Claude Code에서 5개 에이전트가 자동 인식되는지 `/agents` 또는 비슷한 명령으로 확인.
4. 커밋: `feat: add 5 project-specific subagents for engine QA`.

### Step 2: P0-2 (LLM 4단 모델 매핑) — 1주 작업

1. **신규 파일**: `src/types/llm.ts` — `ModelTier` enum + `LLMModel` 타입 (5종).
2. **신규 파일**: `src/lib/llm/model-router.ts` — `selectModel(modeOrFlow: string): LLMModel` 함수. Decision 1 매핑표 그대로.
3. **수정 파일**:
   - `src/lib/llm/openai.ts:79` — `DEFAULT_LLM_MODEL` 제거, `selectModel()` 호출.
   - `src/lib/llm/constants.ts` — 5종 모델 ID 상수 정의.
   - `src/lib/hapcard/builder.ts` — `selectModel('hapcard')` 호출.
   - `src/lib/whatif/builder.ts` — `selectModel('whatif')` 호출.
   - `src/lib/today/builder.ts` — `selectModel('daily')` 호출.
   - replay route: `selectModel('replay')` 호출.
4. **테스트**:
   - `tests/lib/llm/model-router.test.ts` — 6경로 × 모델 매핑 검증.
   - `tests/lib/llm/openai.test.ts` 갱신.
5. **문서 동시 갱신** (§12 의무): `tech_stack.md` §3 + 본 핸드오프 §1.1 + ADR 추가 (ADR-039 모델 라우팅 잠금?).
6. **서브에이전트 활용**: 변경 후 `prompt-version-auditor` 자동 실행.
7. **커밋**: `feat(llm): implement 4-tier model routing per Decision 1`.

### Step 3: P0-1 (RAG 명리 specialist 감수) — 1주 외부 협업

- 본 작업은 코드가 아닌 외부 협업. 시작:
  1. Google Form 생성 (20건 평가 양식).
  2. 네이버 카페·디스코드 섭외 메시지 작성 (서포터즈 크레딧 제안 포함).
  3. 응답 7일 대기 시작 — 카운터 기록: 2026-05-27 종료.
- 응답 도착 시: 각 자산의 `review_status` 필드 갱신 (`rag-classics-curator` 에이전트 활용).
- 무응답 시 §1.1 재결정 트리거.

---

## 4. 미완료 §1.1 결정 (다음 결정 시점 필요)

- ADR-039 모델 라우팅 잠금 ADR 신규 작성 여부 (P0-2 진행 중 결정).
- 명리 specialist 무응답 시 플랜 B 진입 (예산 $600-1000) — 2026-05-27 트리거.
- 서브에이전트 자동 호출 정책 (PR opened 시 자동 실행 vs 명시 호출만) — P1-1 완료 후 결정.

---

## 5. 보존해야 할 활성 ADR (변경 시 §1.1 승인)

- ADR-002 자유채팅 미제공
- ADR-010 단일 핵심 위계
- ADR-011 별명만, 실명 수집 금지
- ADR-015 재해석 시 명리 근거 항상 표시
- ADR-016 결과 카드 6 컴포넌트 Phase 1 잠금
- ADR-018 모트 = 명리 정확성 자산 ← P0-1 작업의 근거
- ADR-035 점수 결정형 ← scoring-determinism-checker 에이전트 검증 대상
- ADR-037 기술 스택 잠금 ← 모델 매핑 변경 시 동시 갱신
- ADR-038 Hanja 노출 금지 ← hapcard-builder-qa 에이전트 검증 대상

---

## 6. 다음 세션이 읽어야 할 파일 (순서)

1. 본 핸드오프 (`docs/session_engine-audit_handoff_2026-05-20.md`) ← 첫 진입점.
2. 감사 리포트 (`docs/engine_audit_2026-05-20.md`) ← §5 서브에이전트 5종 상세 spec.
3. `CLAUDE.md` §1.1~§1.6 필수 규칙 재확인.
4. `tech_stack.md` §3 모델 매핑 현재 상태 확인 후 갱신.

작업 재개 위치: **§3 Step 1** (서브에이전트 5종 생성).
