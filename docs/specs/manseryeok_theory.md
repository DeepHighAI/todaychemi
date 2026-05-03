# manseryeok_theory.md — TheoryProfile 명세

> **게이트**: Phase 0 G3
> **ADR 참조**: ADR-021 (출생지 경도 보정 UI 격리 — Phase 2로 이월)

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
  ja_si_mode: 'late_zi',          // 야자시 (한국 표준 권장)
  hour_system: 'twelve_branches',
  longitude_correction: false,
  profile_version: 'v1.0_korean_default',
};
```

**야자시(late_zi)**: 23:00~24:00 출생 시 다음 날 자시로 귀속 (한국 명리 표준).
**조자시(early_zi)**: 23:00~24:00 출생 시 당일 자시로 귀속.

---

## 2. ChartCore 캐시 키

```typescript
// src/lib/engine/chart_hash.ts
export function computeChartHash(
  birthDate: string,        // YYYY-MM-DD
  birthTime: string | null, // HH:MM 또는 null
  theoryProfileVersion: string
): string {
  const input = [birthDate, birthTime ?? 'unknown', theoryProfileVersion].join('|');
  return sha256(input);
}
```

`chart_hash = sha256(birth_date + "|" + birth_time + "|" + theory_profile.profile_version)`

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

## 4. ADR-021: 출생지 경도 보정 격리

- **결정**: 경도 보정 UI는 Phase 2로 이월 (MVP에서 `longitude_correction: false` 고정)
- **근거**: `birth_place` → `birth_longitude` 변환 로직과 Expert Mode 실시간 차이 프리뷰가 복잡도를 높임. MVP에서는 설명 텍스트만 표시.
- **Phase 2**: `longitude_correction: true` 활성화 + 서울 기준 -32분 보정 예시 표시

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
