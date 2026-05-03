# release_canary.md — 카나리 릴리스 절차

---

## 1. 환경 3단계 매트릭스

| 환경 | 브랜치 | URL | Supabase | 용도 |
|---|---|---|---|---|
| Local | feature/* | localhost:3000 | supabase start (Docker) | 개발·단위 테스트 |
| Preview | feature/* PR | Vercel Preview URL | Staging 프로젝트 | PR 리뷰·E2E 테스트 |
| Production | main | <domain> | Production 프로젝트 | 실서비스 |

---

## 2. 카나리 배포 절차

```
feature/* 브랜치 push
    ↓
PR 생성 → Vercel Preview 자동 배포
    ↓
PR 리뷰 + E2E 자동 실행 (playwright)
    ↓
main merge → Production 즉시 배포
    ↓
카나리 5% 트래픽 (prompt_versions.canary_pct = 0.05)
    ↓
72시간 모니터링
    ↓
5가지 기준 모두 통과?
  YES → 100% 승격
  NO  → 즉시 롤백
```

---

## 3. 모니터링 72시간 기준

| 지표 | 기준 | 초과 시 |
|---|---|---|
| banned_phrase 감지율 | < 3% | 즉시 롤백 |
| LLM-as-judge 평균 | ≥ 3.0 | 즉시 롤백 |
| 유저 👎 비율 | < 20% | 즉시 롤백 |
| 에러율 (5xx) | < 1% | 즉시 롤백 |
| p95 응답 지연 | < 5초 | 즉시 롤백 |

---

## 4. 프롬프트 카나리 (prompt_versions)

```sql
-- 새 프롬프트 버전 등록
INSERT INTO public.prompt_versions (prompt_name, version, content, status, canary_ratio)
VALUES ('hapcard_main', 'v1.3', '<prompt content>', 'canary', 0.05);

-- 72시간 후 승격
UPDATE public.prompt_versions SET status = 'active', canary_ratio = NULL
WHERE prompt_name = 'hapcard_main' AND version = 'v1.3';

UPDATE public.prompt_versions SET status = 'rolled_back'
WHERE prompt_name = 'hapcard_main' AND version = 'v1.2';
```

Edge Function에서 `user_id` 해시 기반으로 5% 유저에게 신버전 적용.

---

## 5. 즉시 롤백 절차

`docs/runbooks/prompt_rollback.md` 참조.

Vercel 배포 롤백:
```
Vercel Dashboard → Deployments → 이전 배포 → "Promote to Production"
소요 시간: < 1분
```
