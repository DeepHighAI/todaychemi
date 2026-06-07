# 오늘케미 — 기술 스택 결정 문서

> 본 문서는 **개발 착수 전 기술 스택 결정**을 정리한다. 1인 바이브코딩 + 완전 무료(인프라) + Phase 1 빠른 출시를 우선으로 결정되었으며, ADR-037에 의해 잠금된다. 변경 시 양 기획 문서(`fluttering-gathering-island.md`·`PRD.md`) 동시 갱신.

**작성 시점**: Phase 0 G0 진입 전
**검토 주기**: Phase 1.5 출시 후 한도 도달률 점검, Phase 3 SEA 진입 전 호스팅 재검토

---

## 1. 결정 원칙

1. **인프라는 완전 무료** — Vercel Hobby + Supabase Free + GitHub
2. **LLM은 사용량 기반 유료** — OpenAI API (이미 유료 사용 중, 여유 있음)
3. **1인 바이브코딩 친화** — AI 도구 학습량 최대 + 통합 편의성 우선
4. **OpenAI primary + Claude fallback** — OpenAI GPT-5/GPT-5 mini routing, Anthropic Claude fallback, circuit breaker, runtime daily budget
5. **Phase 3 SEA 진입 전 호스팅 재검토** — Vercel → Cloudflare 전환 가능성 열어둠

---

## 2. 최종 스택 — Layer별

| Layer | 채택 | 이유 |
|---|---|---|
| **Frontend** | Next.js 16.2.6 (App Router) | 바이브코딩 친화 1위 (AI 도구 학습량 최대), Route Handlers로 API 통합, Vercel 1급 배포 |
| **Language** | TypeScript | 프론트·백엔드·사주 엔진 타입 공유 |
| **Styling** | Tailwind CSS | AI 코드 생성 친화도 최상 |
| **UI** | shadcn/ui + Radix UI | 결과 카드·바텀시트·모달·토글 빠르게 구성 + 접근성 primitive (WCAG 2.2) |
| **상태 관리** | TanStack Query + Zustand | 서버 상태(Supabase fetch 자동 캐싱) + UI 상태 분리 |
| **차트** | Recharts | 오행맵(결과 카드 [3]) + 변화 그래프(ADR-033) |
| **i18n** | next-intl | Phase 3 vi/th 확장 1급 지원 |
| **테마** | next-themes v0.4 | 다크 모드 토글 (2026-05-17 §1.1 결정, ADR-037 예외) |
| **PWA** | vite-plugin-pwa 대안 = next-pwa 또는 자체 Service Worker | §8.3 캐시 정책 구현 |
| **Backend API** | Next.js Route Handlers | 별도 서버 X, 한 프로젝트 통합 |
| **DB·Auth·Storage** | Supabase Free (Postgres + Auth + RLS + Storage) | DB 500MB / 파일 1GB / MAU 50K 무료 |
| **캐시** | Supabase table cache + Next.js fetch cache | Phase 1 충분, Phase 3 진입 시 Edge 캐시 재검토 |
| **Realtime** | 미사용 | 우리 서비스 실시간성 핵심 X |
| **만세력** | ssaju + manseryeok-js + KASI precompute | 다중 검증 (ADR-003). ssaju = 年/月/時柱(절기·입춘 기준) 프로덕션 source + day_pillar cross-validator. KASI = day_pillar 진본 (year/month/hour: 절기 시각 API 부재 또는 야자시 학파 차이로 cross-validation 불가, 2026-05-03 §1.1 결정). 야자시 처리 = 조자시 통합 학파 (ssaju 동일 기준). manseryeok-js = 보조 cross-validator. |
| **사주 엔진** | 자체 TypeScript fortune-core (monorepo 패키지) | ADR-035 `compatibility_scoring_spec.md` 구현. 결정형 점수 보장 |
| **LLM 핵심** | **OpenAI API** (GPT-5/GPT-5 mini routing) | 본 문서 §3 |
| **LLM Fallback** | Anthropic Claude (`claude-sonnet-4-5` 기본) | §11.4 다운그레이드 경로 |
| **결제** | 토스페이먼츠 V2 `@tosspayments/tosspayments-sdk` (KR) / Stripe (Phase 3 SEA) | ADR-005. v1은 부적 지갑 + redirect confirm 경로 |
| **분석** | GA4 + Sentry Free + PostHog Free (Phase 1.5+) | ADR-019 |
| **테스트** | Vitest + Playwright + Zod | 단위·E2E·스키마 검증, 바이브코딩 회귀 방지 |
| **Hosting** | Vercel Hobby | Next.js 1급. Phase 3 SEA 진입 전 Cloudflare 전환 검토 |
| **패키징** | PWA + Bubblewrap (Android TWA) | ADR-031 |
| **CI** | GitHub Actions | 무료 (공개 저장소 무제한, 비공개 일부 무료) |

---

## 3. LLM — OpenAI 모델 매핑 + Claude fallback

### 3.1 콘텐츠별 모델

| 콘텐츠 | 모델 | 토큰 | 호출 빈도 | 위계 |
|---|---|---|---|---|
| 합보기 6모드 (§3.2) | **GPT-5** | in 3,500 + out 800 | 1회/요청 | **핵심** |
| 마이플레이 (§3.4) | GPT-5 | in 2,500 + out 600 | 1회/시리즈 | 보조 |
| 친구합 (Pair Quiz) Pair Quiz | GPT-5 | in 4,000 + out 1,000 | 1회/Pair | 보조 |
| 딥합 (깊이 리포트) | **GPT-5** | in 4,000 + out 1,500 | 1회/리포트 | 보조 (Phase 2) |
| 오늘 케미 (오늘 케미 / 3축) | **GPT-5** | in 2,200 + out 350 | 1인/1일 Lazy | 핵심 |
| **Fallback (장애 시)** | Claude fallback (`claude-sonnet-4-5` 기본) | 동일 | OpenAI retryable failure 또는 circuit open | — |

### 3.2 모델 선택 근거

- **GPT-5 (핵심)**: 한국어 명리 톤 + 6모드 정확성 + 품질·비용·속도 균형
- **GPT-5 (깊이 리포트만)**: 1,500-2,000자 본문 + 고전 인용에 최상위 품질 필요. 호출 빈도 낮아 비용 영향 작음
- **GPT-5 (오늘 케미 3축, G2 / Phase 3, 2026-05-28)**: 사용자·인연·오늘 일진 3축 종합 해석. mini → 격상. 인연 종합이 매일 첫 화면에서 차별점이 되려면 mini 톤보다 깊이가 필요. 사용자 §1.1 확정.
- **GPT-5 mini (대량 보조)**: 단축 카피 단독 호출 등에서 잔존 사용 가능. 현재 오늘 케미 단독축은 동일 모델(gpt-5)로 통일.
- **Claude fallback**: OpenAI retryable failure 또는 circuit open 시 구조화 응답 생성을 대체한다. 현재 기본값은 `claude-sonnet-4-5`이며, 변경 시 모델·비용·개인정보 검토가 필요하다.
- **GPT-5 nano 미채택**: 명리 톤 banned_phrases 회귀 위험
- **o1/o3 reasoning 미채택**: 우리 콘텐츠는 *명리 코퍼스 톤 출력*이지 reasoning이 아님

### 3.3 비용 추산 (DAU 1,000)

| 콘텐츠 | 월 호출 | 모델 | 추정 비용 |
|---|---|---|---|
| 오늘 케미 (3축) | 12,000 | GPT-5 | ~$25-40 (mini 대비 ~$22 증가, G2 / Phase 3 격상) |
| 합보기 | 5,000 | GPT-5 | ~$50-80 |
| 마이플레이 | 1,000 | GPT-5 | ~$10-15 |
| 딥합 | 100 (Phase 2+) | GPT-5 | ~$5-10 |
| **합계** | | | **월 $70-110** |

> 추정치. 정확 가격은 OpenAI 공식 [platform.openai.com/docs/pricing](https://platform.openai.com/docs/pricing) 참조.
> §7.2 일 $20 글로벌 캡 + 결과 캐시 30일 TTL로 통제.
> Production runtime은 `llm_cost_tracking.total_usd` 기준으로 추정 비용을 누적하고 `LLM_DAILY_BUDGET_USD` 초과 시 신규 LLM 호출을 차단한다.

### 3.4 모델 카나리·롤백

- `prompt_versions` 테이블에 `model_name` 필드 추가 (`gpt-5`, `gpt-5-mini`)
- 모델 변경 시 카나리 5% → 72시간 모니터링 → 승격/롤백 (ADR-008과 동일)
- 모델 카나리 실패 트리거: banned_phrases > 3% / LLM-as-judge < 3.0 / 👎 > 20%

### 3.5 PII·ZDR 정책

- **OpenAI API ZDR (Zero Data Retention)** 적용 — production launch 전 ZDR 적용 project를 확인하고 `OPENAI_PROJECT_ID`를 필수 설정
- OpenAI API key와 `OPENAI_PROJECT_ID`는 같은 organization/project 범위에서 발급·연결한다.
- LLM 페이로드 = `chart_core + question_slot + theory_profile.profile_version`만
- **5필드 + gender 원본 절대 미전달** — 단일 정의: `docs/legal/pii_minimization.md`
- 위반 발견 시 PR 차단 + `AGENTS.md` §1.1 사용자 보고 의무

### 3.6 Fallback 전환 (§11.4 수정)

```
OpenAI retryable failure 3회 / 5min 또는 circuit open
  → fallback: Anthropic Claude (`ANTHROPIC_FALLBACK_MODEL`, 기본 claude-sonnet-4-5)
  → Anthropic도 장애 시: 캐시된 interpretations만 노출 + "일시 점검 중" 배너
  → 신규 요청 시 LLM_ALL_PROVIDERS_DOWN 응답
```

Runtime circuit breaker: 5분 동안 retryable failure 3회 이상 시 OpenAI 신규 요청을 30분 skip.

---

## 4. 무료 한도 모니터링

| 서비스 | 무료 한도 | 도달 예상 시점 | 유료 전환 비용 |
|---|---|---|---|
| **Vercel Hobby** | 100GB 대역폭/월 + 100K 서버리스 호출/일 | MAU ~5K-10K | Pro $20/월 |
| **Supabase Free** | DB 500MB · MAU 50K · 파일 1GB · Edge Function 500K/월 | MAU 50K 또는 DB 가득 | Pro $25/월 |
| **Sentry Free** | 5K 에러/월 | 에러 폭증 시 | Team $26/월 |
| **PostHog Free** | 1M 이벤트/월 | MAU ~10K-30K | 사용량 기반 |
| **GA4** | 무제한 | — | 무료 |
| **OpenAI API** | 무료 한도 없음 | 첫날부터 사용량 결제 | §7.2 일 $20 캡 |

**Phase 1.5 출시 후 한도 도달률 모니터링** 의무 (`/admin/sre` 대시보드).

---

## 5. Phase 3 SEA 진입 전 호스팅 재검토

| 항목 | Phase 1-2 | Phase 3 SEA |
|---|---|---|
| Hosting | Vercel Hobby | **Cloudflare Pages + Workers 또는 Vercel Pro + Edge Functions** 검토 |
| 캐시 | Supabase + Next.js fetch | **Cloudflare KV** 또는 Vercel Edge Cache |
| Edge 분산 | 미국·아시아(Vercel) | **전 세계 300+ 도시 (Cloudflare)** — 베트남·태국 응답 속도 결정적 |

**재검토 트리거**: Phase 1.5 출시 후 SEA 게이트 (D30 retention ≥ 20% 또는 paid ARPPU ≥ ₩7,000) 통과 시점.

---

## 6. 바이브코딩 도구 (1인 개발자 무료 우선)

| 도구 | 역할 | 무료 한도 |
|---|---|---|
| **Cursor** | AI 페어 프로그래밍 IDE | 무료 tier (월 50회 GPT-4) — Hobby 충분 |
| **GitHub Copilot Free** | 코드 자동완성 | 월 2,000회 완성 + 50회 채팅 무료 |
| **v0.dev** (Vercel) | 시안 → React 컴포넌트 자동 생성 | 일 ~10회 무료 |
| **Bolt.new** | 풀스택 프로토타입 자동 생성 | 일일 무료 토큰 |
| **Claude.ai 무료** | 설계·디버깅·문서 보조 | 일일 메시지 한도 |
| **GitHub** | 코드 저장 + Actions(CI) | 공개 무제한 |

**추천 워크플로**:
1. 시안 → v0.dev → React 컴포넌트
2. Cursor 무료 tier로 Next.js + Supabase 코딩
3. Claude.ai로 디버깅·문서 보조
4. GitHub Copilot Free로 자동완성

---

## 7. ADR 참조

본 결정과 관련된 ADR:

- **ADR-003**: 만세력 = KASI + ssaju + manseryeok-js 다중 검증
- **ADR-004**: PII 최소화 — birth data 원본 LLM 미전달
- **ADR-018**: 모트 = 명리 정확성 자산 (KASI Agreement + ssaju + manseryeok-js + prompt_version + banned_phrases + 고전 RAG)
- **ADR-031**: TWA 실기기 PoC 확대 — Phase 0 G5+ 5종 검증
- **ADR-035**: 호환성 점수 계산 스펙 분리 (`compatibility_scoring_spec.md`)
- **ADR-037 (신규)**: 본 기술 스택 결정 잠금 — Next.js + Supabase + Vercel + OpenAI primary + Anthropic Claude fallback

---

## 8. 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| v1.1 | 2026-05-31 | 런칭 readiness 기준으로 Next.js 16.2.6, OpenAI ZDR project routing, Claude fallback, circuit breaker, LLM daily budget, dependency remediation 상태 반영 |
| v1.0 | Phase 0 G0 진입 시 | 본 문서 작성, ADR-037로 잠금 |

> **본 문서는 ADR-037로 잠금되며, 변경 시 양 기획 문서(`fluttering-gathering-island.md`·`PRD.md`) 동시 갱신 의무.**
