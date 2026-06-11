# manseryeok_theory.md — TheoryProfile 명세

> **게이트**: Phase 0 G3
> **ADR 참조**: ADR-021 (출생지 경도 보정 — **Amended 2026-06-11**: 시주 계산 보정은 조기 이행, UI 만 Phase 2 유지)

---

## 1. TheoryProfile 인터페이스

```typescript
// src/types/engine.ts
export interface TheoryProfile {
  ja_si_mode: 'late_zi' | 'early_zi';      // 야자시(late) | 조자시(early)
  hour_system: 'twelve_branches' | 'twenty_four_schedule';
  longitude_correction: boolean;             // 출생지 경도 기반 진태양시 보정
  profile_version: string;                  // 예: 'v1.0_korean_default'
}

export const DEFAULT_THEORY_PROFILE: TheoryProfile = {
  ja_si_mode: 'early_zi',         // 조자시 통합 (ADR-037 §1.1 확정 2026-05-03 — ssaju 동일 기준)
  hour_system: 'twelve_branches',
  longitude_correction: true,     // ADR-021 Amended 2026-06-11 — 시주 진태양시 보정 활성화
  profile_version: 'v3',          // src/types/chart.ts DEFAULT_THEORY_PROFILE_VERSION 과 동기
};
```

**야자시(late_zi)**: 23:00~24:00 출생 시 다음 날 자시로 귀속.
**조자시(early_zi)**: 23:00~24:00 출생 시 당일 자시로 귀속 — **채택** (ADR-037, ssaju 동일 기준).

**버전 이력**: `v1` = 보정 없음(벽시계 시지 판정) · `v2` = 시주 진태양시 보정(서울 기본 −32.1분 + 균시차, 2026-06-11) · `v3` = 파생층 `derived` embedded(§6, 2026-06-11 — "v3 ⇒ derived 존재" 불변식).

---

## 2. ChartCore 캐시 키

실구현: `src/lib/chart/chart-hash.ts` — 파이프(`|`) 구분 고정 순서 sha256.

`chart_hash = sha256(entity_id | birth_date | birth_date_calendar | is_lunar_leap | effective_birth_time | gender | birth_longitude | theory_profile_version)`

- `birth_longitude` 는 2026-06-11(ADR-021 Amended)에 추가 — 시주 보정 입력이 다르면 차트도 다르다.
- `theory_profile_version` 포함이 엔진 동작 변경 시 전 다운스트림 캐시 분리의 단일 레버.

---

## 3. UI: 이론 옵션 표시

Expert Mode 진입 화면 (더보기 탭 > Expert 만세력 모드):

```
자시 귀속 규칙
  ◉ 야자시 (권장) — 다음 날 자시로 귀속
  ○ 조자시 — 당일 자시로 귀속

출생지 경도 보정 (Phase 2, ADR-021)
  현재 비활성 — Phase 2에서 활성화 예정
```

결과 페이지 정밀도 배지:

```
생시 입력됨 · 야자시 · v1.0_korean_default
```

---

## 4. ADR-021: 출생지 경도 보정 격리 — **Amended 2026-06-11 (§1.1 사용자 확정)**

원결정(2026-05): 경도 보정 UI·계산 모두 Phase 2 이월(`longitude_correction: false` 고정).

**개정 (2026-06-11)** — 실사용 QA에서 시주 불일치 발견(17:0x 출생 → 본 서비스 酉時 vs 통설·교차 서비스 申時)이 트리거. 한국 주류 만세력 통설은 진태양시 보정 적용이므로 **계산은 조기 이행**한다:

1. **적용 범위 = 시주(時支 판정)만.** 년/월/일주는 KASI·ssaju 진본 앵커 유지 — G0 게이트(KASI 100% 일치, ADR-018 모트)가 그대로 보존된다. 보정시가 자정·자시 경계를 넘어도 일간(시두법 기준 day stem)은 입력 날짜의 당일 일간 사용(조자시 통합 학파 유지).
2. **보정식** = 벽시계(KST) + 경도항 `(birth_longitude − 135°) × 4분` + **균시차**(Spencer 1971, 양력 날짜 기반 — 결정형, ADR-035 적합). 서울 기본 −32.1분 ± 균시차(연중 −14~+16분). 구현: `src/lib/kasi/solar-time.ts`.
3. **기본 경도 = 서울 126.978°E** (출생지 미입력 시). 인연 등록의 `birth_longitude` 입력값은 그대로 사용. 온보딩(본인) 경도 입력 **UI는 Phase 2 유지** (원결정의 UI 격리 부분은 존속).
4. **버전 범프**: `DEFAULT_THEORY_PROFILE_VERSION 'v1' → 'v2'`. chart_hash 입력에 버전+경도가 포함되어 케미카드·또 다른 나·오늘 케미 캐시가 자연 분리. 기존 유저는 lazy 재계산(`ensure-user-chart.ts` / `lazy-relation-chart.ts`) + 1회성 백필(`scripts/recompute-charts-v2.ts`)로 재온보딩 없이 전환. *(이력 — 현행 버전은 v3(§6), v3 백필은 `scripts/recompute-charts-v3.ts`.)*
5. **음력 함정**: 균시차 날짜는 반드시 양력 — 음력 입력 출생자는 변환 후 날짜(compute.ts의 solYear/Month/Day)를 사용한다.

---

## 5. G3 체크리스트

- [ ] `TheoryProfile` 인터페이스 정의 (`src/types/engine.ts`)
- [ ] `DEFAULT_THEORY_PROFILE` 상수
- [ ] `computeChartHash()` 함수 + 단위 테스트
- [ ] `TheoryProfile` → ssaju 옵션 매핑 구현 (`src/engines/ssaju_adapter.ts`)
- [ ] Expert Mode UI 선택 화면 (야자시/조자시, 경도 보정은 비활성 표시)
- [ ] 정밀도 배지 컴포넌트 (profile_version 포함)
- [ ] `longitude_correction` Phase 2 이월 마커 코드 주석

**예상 공수**: 2.5일

---

## 6. 파생층 (derived, v3)

> **도입**: 2026-06-11 (theory `v3`). 구현: `src/lib/saju/derive.ts`의 `deriveSaju` — 4기둥 순수 결정형 함수(ADR-035: `Date.now`/`Math.random`/LLM 개입 0건, gender 불요).
> v3부터 `normalizeKasiToChartCore`가 `chart_core.derived`(`SajuDerived`, `derived_version: 1`)를 항상 부착한다 — **"v3 ⇒ derived 존재" 불변식**. 구 v2 jsonb row 호환을 위해 타입은 optional.
> 백필: `scripts/recompute-charts-v3.ts` (멱등, 구 버전 row 보존). 미백필 엔티티는 lazy 재계산 경로가 커버.

### 6.1 지장간 (支藏干) 테이블·가중치

자평(子平) 표준 월률분야 테이블 채택 — ssaju 0.2.0 `k` 테이블과 전수 대조로 고정(`tests/fixtures/ssaju-tables.ts`, 출처 주석 포함).

| 지지 | 여기 | 중기 | 정기 |
|---|---|---|---|
| 子 | – | – | 癸 |
| 丑 | 癸 | 辛 | 己 |
| 寅 | 戊 | 丙 | 甲 |
| 卯 | – | – | 乙 |
| 辰 | 乙 | 癸 | 戊 |
| 巳 | 戊 | 庚 | 丙 |
| 午 | – | 己 | 丁 |
| 未 | 丁 | 乙 | 己 |
| 申 | 戊 | 壬 | 庚 |
| 酉 | – | – | 辛 |
| 戌 | 辛 | 丁 | 戊 |
| 亥 | – | 甲 | 壬 |

**가중치 (정수 ×10 스케일)**: 정기 10 · 중기 5 · 여기 3, 천간 1글자 = 10 (동일 스케일).
부동소수(0.3+0.5류) 비결정성 회피를 위해 정수만 사용(ADR-035). **비율(10:5:3) 자체는 전문가 검토 전 잠정.**

`ohaeng_weighted`는 표면 카운트(`five_elements_counts`)와 **완전 별개 필드** — 표면 카운트는 불가침. 지지 표면오행은 정기 오행과 항상 동일(12지 전수 확인)이므로 이중계상 없음.

### 6.2 신강약 (억부 단순 점수제)

산식 전문 (**학파 단순화·전문가 검토 전 잠정** — `src/lib/saju/sinkang.ts`):

```
score = 50 (base)
      + 20 (득령: 월지 오행 == 일간 오행)
      + 10 × (표면 글자 중 일간과 같은 오행 수)        # own_term
      +  8 × (일간을 생하는 오행 수)                   # support_term (생조)
      −  8 × (일간을 극하는 오행 수)                   # pressure_term
      ± 15 (월지 12운성: 건록·제왕 +15 / 사·절·묘 −15)  # unseong_term
level = score ≥ 70 → 신강 / score ≤ 30 → 신약 / 그 외 → 중화
```

- 표면 글자 = 천간 + 지지 (null 기둥 스킵). 12운성 = 봉법(양순음역), 장생 앵커는 ssaju `me` 테이블과 동일(120건 전수 대조).
- **시간 미상(hour_known=false)**: 6글자 집계로 점수 천장이 낮아지나 **임계값(70/30)은 동일 적용**.
- 월주 null(합성 입력): 득령·운성 항 스킵, `detail.month_unseong = null`.
- `detail` 분해항(base/deukryeong/own/support/pressure/unseong)을 함께 저장 — 설명가능성 + 전문가 검토용.

### 6.3 용신·희신 (억부 1차 룰)

오행 레벨 판정(천간 픽 아님). **전문가 검토 전 잠정** — `src/lib/saju/yongsin.ts`:

- **신약** → primary = 인성(생조 우선 고정), secondary = [비겁], basis `억부신약`
- **신강** → 후보 [관성, 식상, 재성] 중 `ohaeng_weighted` 최대(명식에 실재해야 작동; 동률 시 고정 우선순위 관성 > 식상 > 재성), basis `억부신강`
- **중화** → primary = `ohaeng_weighted` 최소 오행(동률 시 목화토금수 순), secondary = [], basis `중화보완`
- **희신** = 용신을 생하는 오행 (표준 1차 규칙)

**ssaju M/K 룩업 미채택 사유**: ssaju `K` 함수는 `"strong"===n ? r.weak : r.strong` — strength가 strong일 때 `M[stem].weak` 배열을 반환하는 역전 구조로, `M` 키 명명과 선택 로직이 상호 모순(강한 甲에 癸·丙·己 = 인성 포함). 신뢰 불가 → 자체 억부 룰 채택.

### 6.4 학파 선택 명기

- **지지 음양 = 체(體) 기준** (순서 짝홀: 子양·丑음 …) — ssaju `v` 테이블과 동일. 用 기준 학파(子·巳 등 반전)는 미채택. `yinyang_balance`는 표면 글자(8 또는 6) 집계.
- **띠(tti) = 년지 기준, 절기(입춘) 경계** — `year_pillar` 자체가 절기 기준이므로 민속 음력설 기준과 다를 수 있음.
- 자시 귀속은 §1 그대로 (조자시 통합, ADR-037).

### 6.5 시간 미상 처리 + 재계산 의무

- `hour_pillar = null` → `hour_known: false`, `sipsin.hour`/`jijanggan.hour` null, 십신 counts 합 5(시有 7), 음양 6글자 집계.
- **기둥 변형 시 derived 재계산 의무**: 합성 차트 등에서 기둥을 바꾸면 반드시 `deriveSaju`를 다시 호출한다 — stale derived를 옮겨 붙이는 것 금지.

### 6.6 교차분석 (CrossAnalysis, cross-v1)

> 구현: `src/lib/saju/cross.ts` `computeCrossAnalysis` — 두 ChartCore의 순수 결정형 함수
> (ADR-035 무개입, ADR-040). **비영속** — 요청 시 매번 계산, LLM 페이로드 전용.
> 모든 간지 입력은 `normalizeGanji` 선적용(한글·한자 이중 인코딩 면역).

- **십신 교차 (양방향)**: 내 일간 기준으로 상대 8글자(천간 4 직접 + 지지 4 **정기만** —
  중기·여기는 교차에서 미사용, 단순화 명기) 십신 판별 + 역방향 동일. 5그룹(비겁/식상/재성/관성/인성)
  분포 + 결정형 salient 템플릿 문장 ≤3 (선정 규칙 잠금: ① 타깃 일간 슬롯 항상 1문장 ② 최다 그룹
  count ≥ 3 ③ 재성+관성 합 ≥ 4 현실축 집중).
- **궁위 귀속**: `computeHapChungHyungHaeRaw` 이벤트의 `pillarIndex`를 궁위 라벨로 변환.
  삼합·삼형 등 다주 합성 이벤트는 단일 궁위 귀속 불가 → `palace: null`.
  자형은 동일 슬롯 쌍이므로 궁위 귀속됨. 형·삼합 계열의 참여 지지는 raw 이벤트의
  `participants` 메타데이터(점수 무영향)로 전달되어 detail 문장을 직접 구성한다.

  | 궁위 | 의미 (`palace_meaning`) |
  |---|---|
  | 년주 | 뿌리·초년 |
  | 월주 | 사회·부모 |
  | 일주 | 배우자궁·자아 |
  | 시주 | 미래·자식 |

- **운세 교차**: 양측 현재 대운 3방향(내대운↔상대일주 / 상대대운↔내일주 / 대운↔대운) +
  세운·월운·일운(공유 간지)↔양측 일주. **합·충만 검출** (형·파·해는 운세 교차 범위 외 —
  yunse_spec §8.5 정합).
- **일간 배합**: 두 일간 글자·음양 극성·천간합 여부. 썸합/오래합 모드 한정 재성·관성 방향성 문장.
- **연령차 밴드**: 출생 연도는 서버 내부 입력 — 출력물에는 `band`(동갑/1-3/4-6/7+)와
  `relation_is`(연상/연하/동갑)만 진입. 양력 연도 뺄셈이므로 **음력 연초(입춘 전후) ±1 오차 존재
  — 문서화된 단순화** (밴드 폭이 오차를 흡수).

### 6.7 명리 specialist 검수 체크리스트 (파생층·교차분석)

검수 전 잠정 항목 — 검수 시 아래를 항목별 확인:

1. **지장간 12행 테이블** (§6.1) — 월률분야 vs 인원용사 학파 차이 포함 여부 판단, 가중 비율 10:5:3 타당성
2. **십신 판별 10×10** — `src/lib/saju/sipsin.ts` (ssaju 전수 대조 완료, 이론 재확인)
3. **신강약 산식** (§6.2) — 득령20/통근10/생조8/극8/운성±15 계수와 임계값 70/30, 시간 미상 시 동일 임계 적용의 타당성
4. **용신 룰** (§6.3) — 신약→인성 고정, 신강→억부 후보 중 최강, 중화→최소 보완. 조후(調候) 미반영 명기
5. **궁위 의미 4행** (§6.6) — 라벨 카피 톤 포함
6. **연령차 밴드 경계** (동갑·1-3·4-6·7+) — 관계 해석상 유의미한 구간인지
7. **salient 문장 톤** — 결정형 템플릿 문장이 단정적 사실 서술로 안전한지
