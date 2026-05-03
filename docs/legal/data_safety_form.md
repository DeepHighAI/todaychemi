# data_safety_form.md — Google Play Data Safety Form

> **게이트**: Phase 0 G5 (Play Store 등록 전 필수)
> **경고**: 허위/누락 시 앱 제거 가능. 정확히 작성할 것.

---

## 1. 개요

Google Play Console > App content > Data safety 섹션 제출 필수. 아래 항목을 기준으로 작성한다.

---

## 2. 데이터 수집 및 공유 현황

| 수집 항목 | Collected? | Shared? | 공유 대상 | 암호화 | Required? | 근거 |
|---|---|---|---|---|---|---|
| Email address | Yes | No | — | In transit | No (Google OAuth 자동) | 계정 식별 |
| User IDs (auth.uid) | Yes | No | — | In transit + at rest | Yes | 세션 |
| Date of birth | Yes | **No** (chart_core 가공 후 전달, 원본 미전달) | — | In transit + at rest | Yes | 사주 계산 |
| Gender | Yes | **No** (chart_core 가공 후 전달) | — | In transit + at rest | Yes | 사주 계산 |
| Approximate location (시·도 행정구역) | Yes | No | — | In transit + at rest | No (Expert Mode 선택) | 경도 보정 |
| App interactions | Yes | Yes | PostHog | In transit | No | 서비스 개선 |
| Diagnostics (crash) | Yes | Yes | Sentry | In transit | No | 버그 수정 |
| Device IDs | No | — | — | — | — | 미수집 |

> **중요 업데이트**: 구버전 스펙(fortune_architecture.md §7.6.2)에서 Date of birth와 Gender를 "Yes (Anthropic/OpenAI)" 공유로 표기했으나, PII 최소화 정책(docs/legal/pii_minimization.md) 적용으로 **원본은 공유하지 않는다**. chart_core 가공 결과만 LLM에 전달하므로 "No"로 정정.

---

## 3. Security Practices 선언

- [x] Data is encrypted in transit (HTTPS/TLS)
- [x] Data is encrypted at rest (Supabase AES-256)
- [x] Users can request data to be deleted (더보기 > 계정 삭제)
- [ ] Independent security review (Phase 2 이후 검토)

---

## 4. 연령 등급 (IARC)

- 목표 등급: Everyone 10+ (또는 Teen)
- 운세 서비스는 "Simulated Gambling" 아님 → IARC 설문에서 해당 항목 No 응답
- "Paranormal"·"Occult" 관련 문구는 "문화·교육 콘텐츠" 프레이밍으로 조정
- Store listing에 "참고용 콘텐츠" 명시

---

## 5. 위탁 처리자 목록 (Privacy Policy 연동)

| 처리자 | 역할 | 국가 |
|---|---|---|
| Supabase Inc. | DB·Auth·Storage | 미국 |
| OpenAI | LLM (핵심 해석, chart_core만 전달) | 미국 |
| Anthropic PBC | LLM (fallback, chart_core만 전달) | 미국 |
| Vercel Inc. | 웹 호스팅 | 미국 |
| Functional Software (Sentry) | 에러 모니터링 | 미국 |
| PostHog Inc. | 제품 분석 | 미국 |

---

## 6. Phase 0 G5 Pre-launch 체크리스트

- [ ] Google Play Developer Policy Center 운세·점술 관련 최신 정책 확인
- [ ] 특정 지역 배포 제한 (인도네시아·말레이시아 일부) 여부 확인
- [ ] IARC 설문지 완료 (연령 등급 확정)
- [ ] "Paranormal" 관련 문구 점검 + 프레이밍 조정
- [ ] Store listing "참고용 콘텐츠" 명시 확인
- [ ] Google Play Billing 필수 여부 확인 (결제 도입 시)
- [ ] Data Safety Form 8종 항목 최종 제출
- [ ] 개인정보처리방침 URL Play Console 등록
- [ ] 이용약관 URL Play Console 등록
