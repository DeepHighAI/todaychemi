# openai_outage.md — OpenAI 장애 대응 런북

---

## 1. 트리거 조건

- OpenAI retryable failure가 circuit threshold 도달 (3회 / 5분)
- LLM_TIMEOUT (응답 > 20초) 비율 > 10%
- Sentry 알람: `error_code: LLM_TIMEOUT` 또는 `LLM_RATE_LIMIT` 급증

---

## 2. 즉각 대응 (5분 내)

1. `/admin/sre` 대시보드 접속 → LLM 상태 패널 확인
2. https://status.openai.com 상태 확인
3. **자동 fallback 확인**: Circuit breaker가 Claude fallback을 활성화했는지 확인
   ```sql
   -- 최근 5분 error_events 확인
   SELECT error_code, count(*) FROM public.error_events
   WHERE created_at > now() - interval '5 minutes'
   GROUP BY error_code ORDER BY count DESC;
   ```
4. 비상 공지 배너 활성화 (`/admin/sre` > 공지 ON):
   ```
   현재 AI 해석 서비스 응답이 느립니다. 잠시 후 다시 시도해주세요.
   ```

---

## 3. Circuit Breaker 동작 확인

```typescript
// Edge Function 내 circuit breaker 상태
// 5분 동안 retryable failure 3회 → OpenAI 30분간 skip → Claude fallback 자동 전환
// 30분 후 canary 5% → 정상 시 복원
```

fallback 모델: `ANTHROPIC_FALLBACK_MODEL` 값. 미설정 시 `claude-sonnet-4-5` (Anthropic)

---

## 4. 복구 절차

1. status.openai.com에서 "Resolved" 확인
2. Circuit breaker 30분 cooldown 만료 대기 (또는 수동 리셋)
3. Canary 5% 트래픽으로 OpenAI 복원 확인
4. 에러율 정상 복귀 후 비상 공지 배너 OFF
5. `llm_cost_tracking` 확인 (fallback 기간 Anthropic 비용 증가 여부)

---

## 5. 사후 처리

- `reports/incident_YYYY-MM-DD_openai.md` 작성 (`incident_template.md` 사용)
- `llm_cost_tracking` 테이블에서 비용 영향 집계
- Circuit breaker 임계값 조정 필요 여부 검토
- Anthropic fallback 품질 확인 (LLM-as-judge 점수)
