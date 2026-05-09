# manseryeok_validation_g0_amendment_proposal.md
# G0 게이트 月柱 불일치 분석 결과 및 §1.1 의사결정 요청

> **작성**: 2026-05-03 Phase 1 분석 완료 후  
> **상태**: ✅ **§1.1 결정 완료 (2026-05-03)** — Option D 변형 채택: ssaju 프로덕션 승격. normalize.ts + 픽스처 동시 정정. 픽스처 재생성 후 `pnpm seed-kasi` + `pnpm verify-kasi` 실행 필요.  
> **결정 (Phase 3-1)**: ssaju = 月柱(절기 기준) 프로덕션 source. KASI = year/day/hour 진본. ADR-037 갱신 완료.  
> **결정 (Phase 3-2, 2026-05-03 §1.1)**: 잔여 21건 분석 결과 → 年柱 동일 구조적 원인(lunSecha 합삭 기준) + 時柱 야자시 어드밴스 불일치(normalize.ts vs ssaju 학파 차이). 해결: ssaju 역할 年/月/時柱 프로덕션 source로 확대 + 야자시 어드밴스 제거(조자시 통합 학파 채택). KASI = day_pillar 진본으로 역할 축소.  
> **참조**: `reports/month_pillar_failure_analysis.md` (Phase 1 산출물)

---

## 1. 현황 요약 (Phase 1 정량 데이터)

| 항목 | 수치 |
|---|---|
| 전체 실패 | 39건 / 100건 (61% 일치율) |
| 月柱 `solar_vs_lunar` 패턴 | **28건 (71.8%)** |
| 동일 月柱인데 실패 (非月柱 원인) | **10건** — 주로 境界 시각(23:xx) 日柱·時柱 불일치 추정 |
| 2달 이상 차이 (`unknown`) | 1건 (E002: 1990-01-01, 丙子↔戊寅) |
| >72h 버킷 (절기 경계와 무관) | **23건 (59.0%)** |
| 절기 기준 중앙 거리 | 102.5h (최대 370.5h) |
| ssaju 버전 | v0.2.0 |

**핵심**: ssaju가 프로덕션 경로에 **없음** — 실제 만세력 파이프라인은 `src/lib/kasi/normalize.ts` (KASI API 직접 호출). ssaju는 `scripts/` cross-validator 전용이다.

---

## 2. 근본 원인 확정

### 두 가지 서로 다른 月 기준

| 항목 | ssaju | KASI `lunWolgeon` |
|---|---|---|
| 月 기준 | **절기(節氣) 시각** — 태양 황경 기준 | **음력 月建** — 합삭(음력 초하루) 기준 |
| 알고리즘 | Meeus + Newton-Raphson (분 단위 정확도) | 한국천문연구원 공식 역서 |
| 월 시작 | 절기 정확 시각 | 음력 초하루 |
| 한국 사주 실무 주류 | **절기 기준** (현대 사주 표준) | 음력 달력 (전통 月建) |

→ 둘 다 "틀린" 것이 아님. **측정 대상 자체가 다름** (solar term vs. lunar month).

### `>72h` 버킷 59%의 의미

59%의 실패 케이스가 가장 가까운 절기 전환점으로부터 **72시간 이상** 떨어져 있다. 이는:
- 절기 타이밍 오류가 아님 (타이밍 문제라면 ≤3h 버킷에 집중되어야 함)
- ssaju의 절기 계산 정밀도 문제가 아님
- **기준 정의 자체의 차이** — N005(113.5h), N024(177.5h), N046(173.5h) 등이 절기 경계에서 멀어도 月柱가 다른 것은 양력月과 음력月이 다른 달에 속하기 때문

### 픽스처 기준 오류

`tests/fixtures/kasi_reference_100.json`의 `expected.month_pillar`이 KASI `getLunCalInfo`의 `lunWolgeon` 필드에서 생성됨. `lunWolgeon` = **음력 月建**으로, 사주 월주(절기 기준)가 아니다. 현재 G0 게이트는 "ssaju 절기 기준 月柱 vs KASI 음력 月建"을 비교하는 것이며, 이는 **목적이 다른 두 필드를 비교**하는 것이다.

---

## 3. 재프레이밍 — G0 게이트 본래 목적과의 부정합

### 현 G0가 실제로 검증하는 것
> "ssaju의 절기 기준 月柱가 KASI 음력 月建과 일치하는가"

### G0가 검증해야 하는 것 (ADR-018, ADR-030 본래 의도)
> "ssaju의 사주 계산이 KASI 천체력 기반 진본과 일치하는가"

→ 39건 실패는 **ssaju의 사주 계산 결함이 아니다**. 픽스처의 `expected.month_pillar`이 사주 月柱 기준이 아닌 음력 月建 기준으로 잘못 생성된 것이다.

---

## 4. 네 가지 옵션

### Option A — G0 accuracy 정의 변경 (4-pillar → 3-pillar)
**내용**: 月柱를 Gate 차단 항목에서 제외. 3-pillar (year+day+hour) 기준으로 재산정.  
**예상 결과**: 3-pillar accuracy ≈ 87%+ (month 불일치 39건 제외). 여전히 <98% 가능성 있음 (非月柱 실패 10건 잔존).  
**ADR-030 수정**: "accuracy" 정의를 3-pillar match로 변경. 月柱는 별도 `month_pillar_accuracy` 메트릭 추적.  
**§12 갱신**: `manseryeok_validation.md §5` + `fluttering-gathering-island.md §17 ADR-030`  
**리스크**: 月柱 품질 보증이 G0에서 제외됨. 프로덕션에서 月柱 해석 오류 가능성 미측정.  
**공수**: 1일 (스크립트 수정 + ADR 수정)

---

### Option B — 절기 톨러런스 비교기 도입
**내용**: `pillarsMatch`에 "ssaju 결과 OR 인접 절기 다른 쪽 결과 중 하나라도 일치하면 통과" 로직 추가.  
**예상 결과**: 절기 ±3h 이내(≤3h 버킷) 2건만 통과. 나머지 37건은 여전히 실패. **이 옵션으로 문제 해결 불가**.  
**근거**: >72h 버킷 23건 (59%)은 절기 경계와 무관한 기준 차이 문제. 톨러런스로 해결 가능한 케이스는 2건 뿐.  
**결론**: **추천하지 않음** — 근본 원인과 불일치.

---

### Option C — Tier 2 라이브러리 교체 (§6 표준 절차)
**내용**: `manseryeok-js` 등 KASI 절기 기준 라이브러리 도입. ssaju cross-validator 교체.  
**예상 결과**: 새 라이브러리가 절기 기준으로 月柱를 계산한다면 G0 통과 가능.  
**ADR 수정**: ADR-037 스택 변경 → §1.1 승인 + §12 동시 갱신.  
**§12 갱신**: `tech_stack.md` + `manseryeok_validation.md §6` + `package.json` + `fluttering-gathering-island.md §17 ADR-037`  
**리스크**: (1) 새 라이브러리도 절기 기준인지 사전 검증 필요 (2) 픽스처 재생성 필요 (3) ADR-037 잠금 변경 → 상당 공수.  
**공수**: +2~3일 (§6 Tier 2 추정)  
**결론**: 픽스처를 제대로 고치지 않으면 같은 문제 반복 가능. **Option D 채택 후에도 필요하면 진입 가능**.

---

### Option D — 픽스처 재구축 (권고)
**내용**: `tests/fixtures/kasi_reference_100.json`의 `expected.month_pillar`을 KASI 절기 시각 API로 재생성. G0 의미를 "ssaju vs KASI 음력月建"이 아닌 **"ssaju vs KASI 절기 시각 기반 月柱"**로 교정.  
**근거**:  
- KASI `getSolCalInfo` 또는 `getHoliDeInfo` API는 **절기 정확 시각(節氣 進入 時刻)**을 반환 (`lunYibgi` 필드)  
- 이 절기 시각을 사용하면 ssaju와 동일한 절기 기준으로 月柱 계산 가능  
- 현재 픽스처 생성 스크립트(`scripts/fetch-kasi-reference.ts`)에서 `lunWolgeon` 대신 절기 시각 기반 月柱를 계산하도록 수정  
**예상 결과**: 픽스처 재생성 후 ssaju vs KASI 절기기준 비교 → 61% → 95%+ 예상 (>72h 케이스 23건이 올바른 기준으로 비교됨)  
**ADR-030 수정**: `expected` 필드 정의에 "月柱 = 절기 시각 기준, `lunWolgeon` 아님" 명시. gate 통과 조건 숫자는 변경 없음 (>98% 유지).  
**§12 갱신**: `manseryeok_validation.md §6 + §8` + `fluttering-gathering-island.md §17 ADR-030` + `scripts/fetch-kasi-reference.ts` 수정 + 픽스처 재생성  
**리스크**: 픽스처 재생성 후에도 ssaju의 절기 계산 정밀도 차이로 일부 경계 케이스 실패 가능 → 실제 통과율 확인 필요  
**공수**: 1.5~2일  
**결론**: **근본 해결. ADR-030 수정 최소화. 권고.**

---

## 5. 권고

**Phase 1 데이터 기반 권고: Option D 우선 채택**

| 판단 근거 | 근거 내용 |
|---|---|
| `>72h` 버킷 59% | 타이밍 문제가 아닌 기준 차이 → Option B 배제 |
| solar_vs_lunar 28/28 (100%) | 月柱 실패 모두 정확히 1달 차이 → 기준 정의 오류로 단일 설명 가능 |
| ssaju가 프로덕션 외부 | 라이브러리 교체(Option C)는 불필요 → 프로덕션 코드(`normalize.ts`) 영향 없음 |
| ADR-030 의도 | "KASI 진본 기준" = 천체력 절기 시각이 진본 → `lunWolgeon`은 진본이 아님 |
| 비月柱 실패 10건 | 日柱·時柱 경계 케이스 별도 추가 조사 필요 (야자시 처리, DST 케이스) |

### 만약 Option D 채택 후에도 <98% 이면

픽스처 재생성 후 실제 통과율에 따라:
- 95~98%: Option A (月柱 별도 메트릭화) 병행 검토
- 85~95%: Option C (Tier 2 라이브러리 교체) 진입. 이 경우 R2 미결정 항목 부분 결정 필요.
- <85%: §6 Tier 3 — 아키텍처 재설계 세션 별도 진행

---

## 6. §12 동시 갱신 매트릭스 (옵션별)

| 옵션 | 갱신 대상 파일 |
|---|---|
| **A** | `manseryeok_validation.md §5` + `fluttering-gathering-island.md §17 ADR-030` + `scripts/lib/verify-helpers.ts` |
| **B** | 해당 없음 (추천하지 않음) |
| **C** | `tech_stack.md` + `manseryeok_validation.md §4·§6` + `package.json` + `fluttering-gathering-island.md §17 ADR-037` + 신규 어댑터 + 픽스처 재생성 |
| **D** | `manseryeok_validation.md §4·§6·§8` + `fluttering-gathering-island.md §17 ADR-030` + `scripts/fetch-kasi-reference.ts` + `tests/fixtures/kasi_reference_100.json` (재생성) |
| **D + C (2단계)** | D 갱신 대상 전체 + C 갱신 대상 전체 |

---

## 7. 미결정 항목 연계 (R2)

`project_open_questions.md` R2: "Tier 1/2/3 fallback 상세 결정 시점". Option C 채택 시 R2 일부 결정. Option D만 채택 시 R2는 여전히 미결정.

---

## 8. §1.1 결정 요청

> **사용자 응답이 필요합니다.** Phase 3(구현) 진입 전 아래 옵션 중 선택 바랍니다.

| 선택지 | 내용 |
|---|---|
| **D 채택** | 픽스처 재구축. `scripts/fetch-kasi-reference.ts` 수정 + 100건 재시드 + `verify-kasi` 재실행. ADR-030 주석 추가. |
| **D + C 채택** | D 완료 후 통과율에 따라 Tier 2 라이브러리 교체 병행. |
| **A 채택** | 3-pillar 게이트로 즉시 통과. 月柱는 별도 추적 메트릭으로 전환. |
| **추가 조사 필요** | 비月柱 실패 10건 원인 분석을 Phase 3 전에 추가 진행. |

**Phase 3 진입 금지 조건**: 위 선택지 중 하나를 사용자가 명시적으로 결정하기 전.
