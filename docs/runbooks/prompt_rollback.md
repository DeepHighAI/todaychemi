# prompt_rollback.md — 프롬프트 즉시 롤백 절차

---

## 1. prompt_versions 상태 전이

```
active  ──→  canary  ──→  active (승격, 이전 버전은 rolled_back)
                     ──→  rolled_back (롤백)
```

- `active`: 전체 트래픽 적용 버전 (prompt_name 당 1개만)
- `canary`: 5% 트래픽 테스트 버전
- `rolled_back`: 비활성화 (이력 보존)

---

## 2. 롤백 트리거 조건

| 지표 | 임계값 | 확인 방법 |
|---|---|---|
| banned_phrase 감지율 | > 3% / 5분 | Sentry 알람 |
| LLM-as-judge 평균 | < 3.0 | 주간 CI 또는 실시간 |
| 유저 👎 비율 | > 20% | `/admin/sre` 패널 |

---

## 3. 즉시 롤백 SQL

```sql
-- 1. 현재 canary 버전을 rolled_back으로
UPDATE public.prompt_versions
  SET status = 'rolled_back'
  WHERE prompt_name = 'hapcard_main'
    AND status = 'canary';

-- 2. 이전 active 버전으로 복원 (버전 번호 확인 필요)
UPDATE public.prompt_versions
  SET status = 'active'
  WHERE prompt_name = 'hapcard_main'
    AND version = 'v1.2';  -- 롤백할 안정 버전 번호
```

**반영 시간**: Edge Function이 `prompt_versions` 테이블을 실시간 조회하므로 SQL 실행 즉시 반영. < 30초.

---

## 4. 롤백 후 확인

1. `/admin/sre` > 프롬프트 버전 패널에서 active 버전 확인
2. Sentry에서 banned_phrase 감지율 정상화 확인 (5분 대기)
3. LLM 테스트 호출 1건으로 출력 품질 확인
4. 비상 공지 배너 OFF (필요 시)
5. `incident_template.md` 사용하여 롤백 사유 기록

---

## 5. 신버전 재작성 후 재배포

롤백 후 프롬프트 문제 원인 파악 → 수정 → 새 버전 번호로 다시 canary 배포.
