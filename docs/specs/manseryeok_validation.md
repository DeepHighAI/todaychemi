# manseryeok_validation.md — G0 게이트: 만세력 교차 검증 명세

> **게이트**: Phase 0 G0 (모든 다른 게이트의 선행 조건)
> **ADR 참조**: ADR-018 (모트 = 명리 정확성 자산), ADR-030 (검증 범위 확정)
> **단일 truth source**: 본 파일. fortune_architecture.md §15.2.5 는 폐기됨.

---

## 1. G0 게이트 목적

`golbin/ssaju` 라이브러리가 한국천문연구원(KASI) 천체력 기반 진본과 충분히 일치하는지 확인한다. G0 통과 없이는 G1~G5 진입 금지. 이 게이트가 실패하면 아키텍처 핵심 가정이 무너져 전체 재설계가 필요하다.

---

## 2. KASI 선행 검증 (G0 전 필수)

G0 Gate는 "KASI 기반 자체 계산"을 진본(Reference Truth)으로 사용한다. 따라서 KASI utility 자체를 먼저 검증해야 한다.

### 2.1 선행 검증 절차

1. Python 유틸 `scripts/kasi_ground_truth.py` 작성 (천체력 데이터 로드 + 절기 정확 시각 + 월주·일주·시주 계산)
2. 유틸 출력 **10건**을 아래 3곳과 수동 비교:
   - 포스텔러 만세력 Pro (상용)
   - 네이버 만세력 (공공)
   - `urstory/manseryeok-js` CLI (오픈소스)
3. 통과 조건:
   - 10건 전부 3곳과 완전 일치 → KASI utility = 진본 확정
   - 1~2건 불일치 → 원인 분석 (천체력 버전·절기 시각 차이). KASI 원자료 직접 재확인 후 판정.
   - 3건 이상 불일치 → KASI utility 재작성 필요. G0 진입 보류.

### 2.2 산출물

`reports/kasi_utility_verification.json`

```json
{
  "verified_at": "2026-XX-XX",
  "samples_checked": 10,
  "all_match": true,
  "disagreements": [],
  "verdict": "kasi_utility_confirmed_as_reference_truth"
}
```

**예상 공수**: 0.5일

---

## 3. G0 게이트 검증 범위 (ADR-030)

| 카테고리 | 샘플 수 | 내용 |
|---|---|---|
| 일반 케이스 (normal) | 50 | 평일 주간 출생, 표준시 기반. Phil + 가족/지인(동의 전제) + 유명인 공개 생년월일 |
| 경계 케이스 (boundary) | 30 | 자시(23:00~01:00), 절기 경계일 ±1일, 윤년, 음력 윤달 |
| 엣지 케이스 (edge) | 20 | DST 적용 연도(1948~1988), 새벽 경계, 특수 해 |
| **합계** | **100** | |

추가 ADR-030 확장 검증 범위:
- 관계 조합 100쌍 (hapcard 정확성 간접 검증)
- 절기 경계 30건
- 시간 미상(unknown) 케이스 20건
- 음양력 변환 20건

---

## 4. 교차 검증 소스 (KASI 진본 기준)

| 소스 | 등급 | 용도 |
|---|---|---|
| **한국천문연구원(KASI) 천체력·절기 데이터** | **진본 (Reference Truth)** | year/day/hour 최종 중재자. KASI는 절기 시각 API 없음 → month_pillar 진본 제공 불가. |
| **ssaju** | **年/月/時柱 프로덕션 source** | 2026-05-03 §1.1 결정: KASI lunSecha(합삭 기준)·lunWolgeon(음력 月建)이 사주 기준과 다름 → ssaju(절기·입춘 기준)로 교체. 야자시 처리 = 조자시 통합 학파(ssaju 동일 기준). G0 year/month/hour 비교 = self-consistency |
| `urstory/manseryeok-js` | 1차 동의 (Agreement) | KASI 기반 오픈소스, fallback 1순위. month_pillar 교차검증 복원 시 도입 |
| 포스텔러 만세력 Pro | 참고 동의 | 상용 서비스 일치율 참고 |
| 네이버 만세력 | 참고 동의 | 2차 참고 |

> **알려진 한계 (2026-05-03)**: year/month/hour cross-validation 부재. G0에서 year/month/hour_pillar는 ssaju self-consistency(ssaju vs ssaju)만 검증됨. day_pillar만 진정한 KASI cross-validation. manseryeok-js Tier 2 도입 시 회복 가능. 야자시 처리는 조자시 통합 학파 채택 (보수 학파 재논의 시 §1.1 필요).

**지표 정의**:
- `accuracy`: ssaju vs 픽스처(KASI year/day/hour + ssaju month) 일치율 — **Gate 통과 기준**
- `agreement_manseryeok`: ssaju vs manseryeok-js 일치율 (참고)
- `agreement_forceteller`: ssaju vs 포스텔러 일치율 (참고)
- `agreement_naver`: ssaju vs 네이버 일치율 (참고)

---

## 5. Gate 통과 조건

**모두 만족해야 통과** (KASI 진본 기준):

| 카테고리 | 기준 | 허용 실패 건 수 |
|---|---|---|
| **전체 accuracy** | > 98% | 2건 이하 |
| **일반 케이스 accuracy** | = 100% | 0건 |
| **경계 케이스 accuracy** | > 95% | 1건 이하 |
| **엣지 케이스 accuracy** | > 90% | 2건 이하 |

---

## 6. 실패 시 Tier별 대응

| accuracy | Tier | 대응 | 추가 공수 |
|---|---|---|---|
| 95~98% | **Tier 1 — 부분 실패** | 실패 패턴 식별 → 어댑터 레이어 보정 + GitHub Issue 제보 + 회귀 테스트 반영 후 G1 계속 | +1~2일 |
| 85~95% | **Tier 2 — 심각한 실패** | 대체 라이브러리 전환 (우선순위: manseryeok-js → yhj1024/manseryeok → sajupy → fortuneteller). 어댑터만 교체, ChartPackage 스키마 유지. | +2~3일 |
| < 85% | **Tier 3 — 전 라이브러리 실패** | 아키텍처 재설계 세션. 확률 < 2%. 사용자에게 즉시 보고. | 별도 진단 |

> **주의**: Tier 1/2/3 fallback 상세 결정은 R2 미결정 항목(project_open_questions.md)으로 관리. 결정 전까지 구현 보류.

---

## 7. 검증 스크립트

`scripts/verify-ssaju-accuracy.ts`

```typescript
// scripts/verify-ssaju-accuracy.ts
import { calculateSaju } from 'ssaju';
import fs from 'fs';

interface ReferenceSample {
  id: string;
  category: 'normal' | 'boundary' | 'edge';
  input: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    gender: '남' | '여';
    calendar: 'solar' | 'lunar';
  };
  expected: {
    year_pillar: string;   // 예: '庚午'
    month_pillar: string;
    day_pillar: string;
    hour_pillar: string | null;
    day_master_element: string;
    five_elements_counts: Record<string, number>;
    source: 'kasi_derived';  // 진본 마킹
  };
  agreements?: {
    manseryeok_js?: { year_pillar: string; month_pillar: string; day_pillar: string };
    forceteller?: { year_pillar: string; month_pillar: string; day_pillar: string };
    naver?: { year_pillar: string; month_pillar: string; day_pillar: string };
  };
}

// 검증 실행 후 리포트 생성
const report = {
  total_samples: 100,
  accuracy: 0,                    // ssaju vs KASI 일치율
  by_category: {
    normal: { total: 50, passed: 0, accuracy: 0 },
    boundary: { total: 30, passed: 0, accuracy: 0 },
    edge: { total: 20, passed: 0, accuracy: 0 },
  },
  agreement_manseryeok: 0,
  agreement_forceteller: 0,
  agreement_naver: 0,
  failed_samples: [] as string[],
  gate_passed: false,
  generated_at: new Date().toISOString(),
  ssaju_version: '0.1.1',
};

// 산출물: reports/ssaju_verification_report.json
fs.writeFileSync('reports/ssaju_verification_report.json', JSON.stringify(report, null, 2));
```

---

## 8. 레퍼런스 샘플 100건 구성 방법

### 8.1 일반 케이스 50건

- Phil + 가족/지인 (동의 전제)
- 유명인 공개 생년월일 중 KASI 기반 재계산 가능한 것
- 평일 주간 출생, 표준시 기반

### 8.2 경계 케이스 30건

- 각 절기 경계 ±1일 × 12절기 ≈ 24건
- 자시(23:00~01:00) 특수 케이스 6건
  - 야자시(23:00~24:00): 다음 날 자시 귀속
  - 조자시(00:00~01:00): 당일 자시 귀속

### 8.3 엣지 케이스 20건

- 과거 DST 적용 연도(1948~1988) 10건
- 음력 윤달 출생 5건
- 특수 해(경계 해, 서머타임 전환년) 5건

### 8.4 KASI 데이터 확보

- 한국천문연구원 "천체력" 공개 데이터 활용
- 절기 정확 시각을 기준으로 사주 월주 자체 계산
- `scripts/kasi_ground_truth.py` Python 유틸리티로 100건 자동 생성

---

## 9. G0 체크리스트

- [ ] **KASI utility 선행 검증 10건** (§2 참조) ← G0 전 필수
- [ ] `scripts/kasi_ground_truth.py` Python 유틸 작성
- [ ] `reports/kasi_utility_verification.json` 생성 및 PASS 확인
- [ ] 레퍼런스 샘플 100건 수집 (normal 50 + boundary 30 + edge 20)
- [ ] 포스텔러·네이버 agreement 데이터 병행 수집 (수동)
- [ ] `scripts/verify-ssaju-accuracy.ts` 작성
- [ ] 스크립트 실행 → `reports/ssaju_verification_report.json` 생성
- [ ] Gate 조건 검토 (accuracy 기준 4항목 모두 만족)
- [ ] 실패 샘플 패턴 분석
- [ ] 통과 시 G1 진입 / 실패 시 Tier 판정 후 사용자 보고

**예상 공수**: 총 1.5일 (KASI 선행 검증 0.5일 + G0 본 검증 1일)
