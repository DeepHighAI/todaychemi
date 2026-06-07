# privacy_runbook.md — 개인정보 처리 런북

> **게이트**: Phase 0 G5 (출시 전 필수)
> **법적 근거**: 개인정보 보호법(PIPA) Art. 35~37
> **PII 최소화 단일 정의**: `docs/legal/pii_minimization.md` 참조

---

## 1. 수집·이용·보유 정책

| 수집 항목 | 법적 성격 | 이용 목적 | 보유기간 |
|---|---|---|---|
| 이메일 | 일반 PII | 계정 식별 (Google OAuth) | 회원 탈퇴 시까지 |
| 생년월일시 | 민감정보 준함 | 사주 계산 (chart_core 가공) | 회원 탈퇴 + 30일 |
| 성별 | 일반 PII | 사주 계산 (chart_core 가공) | 회원 탈퇴 + 30일 |
| 인연 별명 | 일반 PII | 인연 관계 관리 | 본인 삭제 즉시 / 탈퇴 + 30일 |
| 인연 생년월일·성별 | 제3자 PII | 관계 사주 계산 | 동 |
| 질문·해석 결과 | 이용 기록 | 서비스 품질 개선 | 회원 탈퇴 + 30일 |
| IP·User-Agent | 이용 기록 | 보안·남용 방지 | 90일 |

> 생년월일시는 PIPA "고유식별정보"는 아니지만 민감정보에 준하는 주의 필요. 개인정보처리방침에 별도 고지.

---

## 2. LLM 데이터 전송 규칙

| 필드 | LLM 전달 여부 | 근거 |
|---|---|---|
| gender (원본) | **No** (chart_core 가공 후 전달) | pii_minimization.md |
| birth_date (원본) | **No** (chart_core 가공 후 전달) | pii_minimization.md |
| birth_place (원본) | **No** | pii_minimization.md |
| nickname | **No** | ADR-011, pii_minimization.md |
| email | **No** | pii_minimization.md |
| chart_core | **Yes** | 가공된 사주 데이터 (PII 아님) |

---

## 3. 필수 법적 문서 (G5 완료 조건)

| 문서 | 경로 | 필수 내용 |
|---|---|---|
| 개인정보처리방침 | `/legal/privacy` | 수집 항목·목적·보유·제3자 제공(없음)·위탁(Supabase, OpenAI, Anthropic)·권리행사 |
| 서비스 이용약관 | `/legal/terms` | 서비스 범위·유료 정책(Phase 2+)·이용자 의무·면책·관할 |
| 운세 서비스 면책 고지 | 결과 페이지 하단 상시 | "참고용, 의료·법률·투자 대체 불가" |

**위탁 처리자 공개** (Privacy Policy + Data Safety):
- Supabase Inc. (DB·Auth·Storage·Edge Functions)
- OpenAI (LLM — 핵심 해석, ZDR 계약 의무)
- Anthropic PBC (LLM — fallback)
- Vercel Inc. (웹 호스팅)
- Functional Software, Inc. dba Sentry (에러 모니터링)

---

## 4. 미성년자 보호

- 가입 시 **만 14세 이상 확인 체크박스** (PIPA 법정대리인 동의 기준)
- 만 13세 이하: Google OAuth 반환 생년월일 cross-check → 차단
- 만 14~17세: 법정대리인 동의 플로우 (Phase 2 이후, MVP는 14세 이상만 가입)

---

## 5. 이용자 권리 (PIPA Art. 35~37)

| 권리 | 조항 | 제공 방식 |
|---|---|---|
| 열람권 | Art. 35 | 내 프로필 > "내 데이터 내려받기" (JSON 다운로드) |
| 정정·삭제권 | Art. 36 | 프로필 편집 + "계정 삭제 요청" 버튼 |
| 처리정지권 | Art. 37 | "일시 비활성화" 옵션 |
| 이동권 | (준용) | JSON 다운로드로 대체 |

**삭제 플로우**:
1. 유저 삭제 요청 → `users.deletion_requested_at = now()`
2. **30일 grace period** (복구 가능)
3. 영구 삭제: 개인정보 영역 삭제 + 이용 통계는 `user_id`를 salted hash로 익명화
4. `pg_cron`으로 매일 04:00 KST 자동 실행

---

## 6. 면책 고지 (결과 페이지 하단 상시 노출)

```
운세 해석은 참고용 콘텐츠입니다.

의료·법률·투자·인간관계의 중요한 결정은 반드시
해당 분야 전문가와 상담하세요.
본 서비스는 점술 결과에 기초한 어떠한 결정에
대해서도 책임을 지지 않습니다.
```

---

## 7. G5 체크리스트

- [x] `/legal/privacy` 페이지 작성·배포
- [x] `/legal/terms` 페이지 작성·배포
- [x] 결과 페이지 면책 고지 컴포넌트 (상시 노출)
- [x] 가입 시 만 14세 이상 체크박스
- [x] 인연 등록 시 동의 체크박스 ("인연의 동의를 얻었습니다")
- [x] 데이터 열람 API (JSON export: `GET /api/me/export`)
- [x] 계정 삭제 UI + `deletion_requested_at` 설정 (`POST /api/me/delete-request`)
- [x] 30일 grace period 삭제 스케줄러 (pg_cron: `purge-deleted-users`)
- [ ] 익명화 스크립트 (salted hash 치환)
- [x] LLM 위탁 처리자 Privacy Policy 등재 (OpenAI ZDR 의무 포함)
- [ ] Data Safety Form 완료 (`docs/legal/data_safety_form.md`)
- [ ] PII 최소화 구현 검증 (`docs/legal/pii_minimization.md`)

**예상 공수**: 약 5일 (법적 문서 초안 2일 + 구현 2.5일 + Data Safety 0.5일)
