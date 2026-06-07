# anthropic_outage.md — Anthropic Claude Fallback 장애 런북

---

## 1. 트리거 조건

- OpenAI 장애 + Anthropic Claude fallback도 retryable failure threshold 도달 (3회 / 5분)
- 즉, **두 LLM 공급사가 동시 장애** 상황

---

## 2. 즉각 대응 (5분 내)

1. `LLM_ALL_PROVIDERS_DOWN` 에러 코드 Sentry 알람 확인
2. https://status.anthropic.com 상태 확인
3. **신규 LLM 요청 완전 차단** (환경 변수 플래그):
   ```
   Vercel 환경 변수: LLM_ALL_PROVIDERS_DOWN=true
   → 모든 interpret Edge Function이 즉시 503 반환
   ```
4. 비상 공지 배너 ERROR 레벨 활성화:
   ```
   현재 AI 해석 서비스를 일시 점검 중입니다.
   저장된 이전 결과는 계속 확인하실 수 있습니다.
   ```
5. 캐시된 `hapcards` 읽기 전용 모드 유지 (신규 생성 불가, 조회만 가능)

---

## 3. 유저 경험 영향

- 새 케미카드 생성: 불가 (`LLM_ALL_PROVIDERS_DOWN` 에러)
- 기존 케미카드 조회: 정상
- Daily Hap: 전날 카드 재사용 (`reused_from_yesterday: true`)
- 케미 다시 맞추기(replay): 불가

---

## 4. 복구 절차

1. OpenAI + Anthropic 양쪽 status 페이지 "Resolved" 확인
2. `LLM_ALL_PROVIDERS_DOWN` 환경 변수 제거 또는 `false` 설정
3. Canary 요청 10건으로 동작 검증
4. 비상 공지 배너 OFF
5. 사후 리포트 작성

---

## 5. 사후 처리

- 두 공급사 동시 장애는 극히 드문 사건 → 원인 분석 후 ADR 검토
- 완전 오프라인 폴백(캐시 전용 모드) 영구화 여부 검토
- `incident_template.md` 사용하여 포스트모텀 작성
