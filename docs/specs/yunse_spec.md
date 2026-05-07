# 윤세(運勢) Spec

> 단일 진실 출처(SSOT). 변경 시 §1.1 사용자 승인 필수.

## 1. 개요

본 spec은 윤세 데이터의 범위를 정의한다:

| 적용 범위 | 상태 |
|---|---|
| `/me` 윤세 카드 (4 레이어 시각화) | Phase Y0+Y1 — 이번 구현 |
| 합카드 LLM 컨텍스트 yunse 포함 | Phase Y2 — 별도 PR |
| 점수 결정형 yunse 가중치 | Phase Y3 — 별도 PR |
| ADR-033 change_score + 합피드 자동 정렬 | Phase Y4 — 별도 PR |
| 푸시 트리거 (영향 큰 인연 1명 하이라이트) | Phase Y5 — 별도 PR |

## 2. 명리 이론

### 2.1 시간 단위 계층

| 단위 | 명칭 | 기간 | 간지 수 |
|---|---|---|---|
| 대운 (大運) | `daeun` | 10년 | 출생 순서에 따라 순·역행 |
| 세운 (歲運) | `seyun` | 1년 | 해당 연도 干支 |
| 월운 (月運) | `wolun` | 1개월 | 절기 기준 月干支 |
| 일운 (日運) | `iliun` | 1일 | 해당 일 干支 |

### 2.2 대운 시작 나이

- 생년·성별·가장 가까운 절기까지의 거리에 따라 시작 나이가 결정됨
- 양남(陽男)·음녀(陰女)는 순행(順行), 음남(陰男)·양녀(陽女)는 역행(逆行)
- ssaju v0.2.0 `SajuResult.daeun.startAge`가 산출 — 자체 계산 불필요

### 2.3 ssaju 라이브러리 매핑

| `YunseCore` 필드 | ssaju 소스 |
|---|---|
| `daeun.start_age` | `SajuResult.daeun.startAge` |
| `daeun.list[i].age` | `SajuResult.daeun.list[i].startAge` |
| `daeun.list[i].pillar` | `SajuResult.daeun.list[i].ganzhi` |
| `daeun.list[i].year` | `SajuResult.daeun.list[i].startYear` |
| `daeun.current_index` | `daeun.list.findIndex(d => d.startAge === current.startAge)` |
| `seyun.current_pillar` | `SajuResult.reference.codes.thisYear` |
| `seyun.current_year` | `SajuResult.currentYear` |
| `wolun.current_pillar` | `SajuResult.reference.codes.thisMonth` |
| `wolun.current_month` | KST 현재 날짜 슬라이스 `YYYY-MM` |
| `iliun.today_pillar` | `SajuResult.reference.codes.today` |
| `iliun.today_date` | KST 현재 날짜 `YYYY-MM-DD` |

> `reference.codes`는 ssaju 내부에서 KST 기준으로 계산됨. `normalize.ts`에서 `new Date()`를 ssaju와 동일 시점에 호출하여 일관성 보장.

## 3. 타입 계약

`ChartCore.yunse: YunseCore`로 노출.

```typescript
export interface YunseDaeun {
  readonly start_age: number;
  readonly list: ReadonlyArray<{ age: number; pillar: string; year: number }>;
  readonly current_index: number;
}

export interface YunseSeyun {
  readonly current_pillar: string;
  readonly current_year: number;
}

export interface YunseWolun {
  readonly current_pillar: string;
  readonly current_month: string; // YYYY-MM (KST)
}

export interface YunseIliun {
  readonly today_pillar: string;
  readonly today_date: string; // YYYY-MM-DD (KST)
}

export interface YunseCore {
  readonly daeun: YunseDaeun;
  readonly seyun: YunseSeyun;
  readonly wolun: YunseWolun;
  readonly iliun: YunseIliun;
}
```

## 4. 결정형 원칙

- **시각화(Y1) + 점수 계산(Y3)**: 결정형. ssaju 결과를 그대로 사용, LLM 개입 없음 — ADR-035 준수.
- **LLM 해설 컨텍스트(Y2)**: yunse를 `chart_core` 페이로드에 포함하여 LLM에 전달. LLM은 해설만 생성하며 점수 산출에 관여하지 않음.
- **PII**: yunse는 비식별 명리 데이터 (干支 문자열 + 나이 + 연도만). `docs/legal/pii_minimization.md` §5 위반 아님.

## 5. chart-hash 안정성

`deriveChartHash(ChartHashInput)`은 birth data 입력값만 해시하며, `ChartCore` 필드를 사용하지 않는다. 따라서 yunse를 `ChartCore`에 추가해도 hapcard 캐시 무효화 없음.

단, yunse는 **매일 `iliun.today_date`가 변하므로** chart 캐시 키가 아닌 hapcard 요청별 캐시 키(`date_kst` 포함)로 처리됨 — 기존 동작 유지.

## 6. 점수 산식 (Phase Y3 placeholder)

> 이 섹션은 Phase Y3에서 채워진다. 윤세 가중치·중첩 처리·change_score 정의는 미확정.

요구사항:
- `change_score = current_compat_score - previous_snapshot_score` (ADR-036)
- 대운 전환 시 ±10p 이내의 가중치 — 결정형, LLM 산출 금지
- `compatibility_scoring_spec.md`에 §yunse 섹션 추가 예정

## 7. LLM 페이로드 (Phase Y2)

> Phase Y2에서 `src/lib/hapcard/builder.ts`의 `chart_core` 페이로드 빌더에 yunse 추가.

- `chart_core.yunse`를 LLM에 전달: `{ daeun.current_index, daeun.list[current], seyun, wolun, iliun }` — 현재 대운 1개 + 나머지 3 레이어
- 전체 대운 list(10개)는 LLM에 불필요 → 현재 대운 1개만 전달하여 토큰 절약
- 예상 토큰 증가: ~80-120 tokens per hapcard call

## 8. 버전 및 변경 절차

본 spec 변경 시 §1.1 사용자 승인 필수. Phase Y2~Y5 진입 전 각 섹션 상세 명세를 추가한다.
