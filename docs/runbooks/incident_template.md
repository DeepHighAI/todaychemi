# incident_template.md — 인시던트 기록 템플릿

복사하여 `reports/incident_YYYY-MM-DD_<short_title>.md`로 저장.

---

## 인시던트 요약

| 항목 | 값 |
|---|---|
| 제목 | [인시던트 제목] |
| 날짜 | YYYY-MM-DD |
| 심각도 | P0 (전체 중단) / P1 (핵심 기능 영향) / P2 (부분 영향) / P3 (경미) |
| 상태 | 진행중 / 해결됨 |
| 담당자 | Phil |

---

## 1. Impact (영향 범위)

- 영향받은 기능:
- 영향받은 유저 수 (추정):
- 지속 시간: XX시간 XX분 (HH:MM KST ~ HH:MM KST)
- 수익 영향:

---

## 2. Root Cause (근본 원인)

[근본 원인을 1~3문장으로 설명]

---

## 3. Timeline (타임라인)

| 시각 (KST) | 이벤트 |
|---|---|
| HH:MM | 장애 시작 (또는 최초 감지) |
| HH:MM | Sentry 알람 수신 |
| HH:MM | 대응 시작 |
| HH:MM | 완화 조치 적용 |
| HH:MM | 원인 파악 |
| HH:MM | 해결 완료 |
| HH:MM | 모니터링 정상화 확인 |

---

## 4. Action Items (후속 조치)

| 항목 | 담당 | 기한 |
|---|---|---|
| [조치 1] | Phil | YYYY-MM-DD |
| [조치 2] | Phil | YYYY-MM-DD |

---

## 5. Prevention (재발 방지)

- 이번 인시던트를 통해 발견된 시스템 취약점:
- 추가 모니터링 알람 필요 항목:
- 런북 업데이트 필요 항목:
- ADR 검토 필요 여부:
