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
  profile_version: 'v2',          // src/types/chart.ts DEFAULT_THEORY_PROFILE_VERSION 과 동기
};
```

**야자시(late_zi)**: 23:00~24:00 출생 시 다음 날 자시로 귀속.
**조자시(early_zi)**: 23:00~24:00 출생 시 당일 자시로 귀속 — **채택** (ADR-037, ssaju 동일 기준).

**버전 이력**: `v1` = 보정 없음(벽시계 시지 판정) · `v2` = 시주 진태양시 보정(서울 기본 −32.1분 + 균시차, 2026-06-11).

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
4. **버전 범프**: `DEFAULT_THEORY_PROFILE_VERSION 'v1' → 'v2'`. chart_hash 입력에 버전+경도가 포함되어 케미카드·또 다른 나·오늘 케미 캐시가 자연 분리. 기존 유저는 lazy 재계산(`ensure-user-chart.ts` / `lazy-relation-chart.ts`) + 1회성 백필(`scripts/recompute-charts-v2.ts`)로 재온보딩 없이 전환.
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
