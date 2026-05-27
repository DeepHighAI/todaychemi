# docs/ — TWODAY 보조 스펙 인덱스

> 루트 7개 MD(권위 문서)는 변경하지 않는다. 본 디렉토리는 (a) 권위 문서가 약속만 하고 미생성한 보조 스펙, (b) 폐기된 fortune_architecture.md(v3.3)의 유효 추출분, (c) PR-0~G0 게이트 차단 spec을 담는다.

## 구조

| 디렉토리 | 책임 | 권위 문서와 관계 |
|---|---|---|
| `specs/` | 데이터 모델·API·결제·검증·i18n·DoD spec | 권위 문서가 cross-ref로 참조 |
| `runbooks/` | 장애 대응·정기 작업·카나리 절차 | fluttering §11에서 약속됐던 6+종 |
| `legal/` | 개인정보·약관·Data Safety·PII 5필드 단일 정의 | CLAUDE.md §5 단일 truth source |
| `patterns/` | Next.js 15 + Supabase + TWA 등 구현 패턴 레퍼런스 | 코드 작성 시 참조용 |
| `qa/` | 수동 검수·브라우저 smoke·출시 전 점검 자료 | 자동 테스트가 대체할 수 없는 검수 기록 |

## 인덱스

### specs/
- [contracts.md](specs/contracts.md) — types/*.ts 인덱스 + Zod 스키마
- [db_schema.md](specs/db_schema.md) — Postgres DDL + RLS (CRM 모델)
- [api_routes.md](specs/api_routes.md) — Route Handlers + Server Actions
- [secrets.md](specs/secrets.md) — .env 변수 카탈로그
- [ci_cd.md](specs/ci_cd.md) — GitHub Actions + Vercel + branch protection
- [monitoring.md](specs/monitoring.md) — 무료 한도 알람 임계
- [payments.md](specs/payments.md) — 토스페이먼츠 (Phase 1)
- [definition_of_done.md](specs/definition_of_done.md) — PR-0/G0/G1 게이트
- [i18n_keys.md](specs/i18n_keys.md) — next-intl 키 컨벤션
- [errors.md](specs/errors.md) — 에러 코드 매트릭스
- [manseryeok_theory.md](specs/manseryeok_theory.md) — TheoryProfile
- [manseryeok_validation.md](specs/manseryeok_validation.md) — G0 게이트 (KASI 100건)
- [llm_quality_regression.md](specs/llm_quality_regression.md) — 품질 회귀
- [llm_grounding.md](specs/llm_grounding.md) — 원문 인용
- [llm_governance.md](specs/llm_governance.md) — 비용·주입 방어·카나리
- [today_hap.md](specs/today_hap.md) — Daily Card 파이프라인
- [concept_dictionary.md](specs/concept_dictionary.md) — 학습 콘텐츠 (Phase 1.5+)

### runbooks/
- [release_canary.md](runbooks/release_canary.md)
- [sre_routine.md](runbooks/sre_routine.md)
- [openai_outage.md](runbooks/openai_outage.md)
- [anthropic_outage.md](runbooks/anthropic_outage.md)
- [supabase_outage.md](runbooks/supabase_outage.md)
- [vercel_outage.md](runbooks/vercel_outage.md)
- [api_key_rotation.md](runbooks/api_key_rotation.md)
- [prompt_rollback.md](runbooks/prompt_rollback.md)
- [incident_template.md](runbooks/incident_template.md)
- [google_oauth.md](runbooks/google_oauth.md) — 오늘사이 Google OAuth 원격 설정
- [kakao_oauth_share.md](runbooks/kakao_oauth_share.md) — Kakao OAuth + KakaoTalk Share callback 설정

### legal/
- [privacy_runbook.md](legal/privacy_runbook.md) — PIPA Art 35-37
- [terms_of_service.md](legal/terms_of_service.md) — 오늘사이 이용약관 원문
- [privacy_policy.md](legal/privacy_policy.md) — 오늘사이 개인정보 처리방침 원문
- [refund_policy.md](legal/refund_policy.md) — 유료 부적 환불 정책
- [data_safety_form.md](legal/data_safety_form.md) — Google Play
- [pii_minimization.md](legal/pii_minimization.md) — 5필드 + gender 단일 정의

### patterns/
- [nextjs15_supabase_ssr.md](patterns/nextjs15_supabase_ssr.md)
- [vercel_ai_sdk.md](patterns/vercel_ai_sdk.md)
- [pgvector.md](patterns/pgvector.md)
- [twa_bubblewrap.md](patterns/twa_bubblewrap.md)
- [tsconfig_strict.md](patterns/tsconfig_strict.md)
- [supabase_callback.md](patterns/supabase_callback.md)

### qa/
- [rag_classics_review_packet.md](qa/rag_classics_review_packet.md) — 오늘 우리는/그럴리 없어! 다시 고전 20건 명리 검수팩
