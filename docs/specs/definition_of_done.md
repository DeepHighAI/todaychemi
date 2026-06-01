# Definition of Done (DoD)

> 각 게이트는 다음 단계로 진입하기 위한 최소 조건이다. 조건 미충족 시 진입 불가.
> 게이트 통과 여부는 사용자 최종 확인 후 기록 (AGENTS.md §1.1).

---

## PR-0 (Scaffold) DoD

Next.js 스캐폴드 생성 직후 PR-0 머지 전 충족 조건:

- [ ] `pnpm tsc --noEmit` — PASS (0 errors)
- [ ] `pnpm lint` — PASS (0 errors)
- [ ] `pnpm vitest run` — PASS (0 tests, 0 failures — 테스트 파일 없어도 통과)
- [ ] Vercel Preview 빌드 성공 (PR 연결된 Preview URL 생성 확인)
- [ ] `README.md` 업데이트 (프로젝트명, 로컬 실행 방법)
- [ ] `src/types/` 디렉토리 생성 + `docs/specs/contracts.md` 기준 초기 타입 파일 작성
- [ ] `.env.local.example` 파일 생성 (`docs/specs/secrets.md` 변수 목록 포함, 값은 빈칸)
- [ ] `.gitignore`에 `.env*`, `*.keystore` 등 민감 파일 제외 확인

---

## G0 게이트: 만세력 정확도

**기준 문서**: `docs/specs/manseryeok_validation.md` (별도 작성 예정)

- [ ] KASI API 기준 검증 코퍼스 100 샘플 이상 확보
- [ ] ssaju + manseryeok-js 다중 검증 일치율 **> 98%**
- [ ] 자시 경계(23:00 vs 00:00) 엣지케이스 처리 확인 (`ja_si_mode`)
- [ ] 음력 → 양력 변환 엣지케이스 (윤달, 1900년 이전) 처리 확인
- [ ] `fortune-core` 패키지 `pnpm vitest run` PASS
- [ ] ADR-018 모트 자산 항목 충족:
  - [ ] KASI Agreement 수치 문서화
  - [ ] 다중 검증 불일치 케이스 분류 기록
  - [ ] 고전 RAG 데이터셋 초안 확보

---

## G1 게이트: 성능

**측정 도구**: Lighthouse CI (`/benchmark` 스킬)

- [ ] Lighthouse Performance **≥ 90** (모바일 기준)
- [ ] CLS (Cumulative Layout Shift) **< 0.1**
- [ ] LCP (Largest Contentful Paint) **< 2.5s**
- [ ] FCP (First Contentful Paint) **< 1.8s**
- [ ] TTI (Time to Interactive) **< 3.8s**
- [ ] Lighthouse Accessibility **≥ 90**
- [ ] Core Web Vitals 3개 모두 "Good" 등급

---

## G2 게이트: LLM 품질

**측정 도구**: 자동화 코퍼스 테스트 + LLM-as-judge

- [ ] 금지 어구(banned_phrase) 히트율 **< 3%** (모니터링 기준, `docs/specs/monitoring.md` §2 패널4)
- [ ] LLM-as-judge 점수 **≥ 3.5 / 5.0** (샘플 50개 이상)
- [ ] GPT-5 → Claude fallback 비율 **< 20%** (정상 OpenAI 상태 기준)
- [ ] 응답 시간 p95 **< 8초** (streaming 첫 청크 기준)
- [ ] 6모드 × 3개 샘플 = 18개 합카드 수동 품질 검수 통과
- [ ] banned_phrases 코퍼스 버전 문서화 (prompt_versions 테이블 연결)
- [ ] `/codex challenge` 프롬프트 2차 의견 PASS

---

## G3 게이트: 이론 프로필 버전 관리

- [ ] `TheoryProfile.profile_version` 첫 버전 태그 확정 (예: `v1.0.0`)
- [ ] `ja_si_mode` 설정 값 결정 및 ADR 기록
- [ ] `longitude_correction` 활성화 여부 결정 및 ADR 기록
- [ ] KASI Agreement 수치 공식 문서화 (ADR-018 업데이트)
- [ ] theory_profile 변경 시 하위 호환성 정책 수립

---

## G4 게이트: 고전 인용

**출처**: ADR-004 고전 RAG

- [ ] 생성된 합카드 `evidence.classics_quotes` 배열 **100%** 비율로 1개 이상 포함
- [ ] 인용 출처(source) 목록 확정 및 문서화
- [ ] `original` (원문) + `modern` (현대어 해석) 양식 준수 확인
- [ ] 고전 RAG 데이터셋 최종 버전 태그

---

## G5 게이트: 출시 (Phase 1 Launch)

### PIPA(개인정보보호법) 체크리스트

- [ ] 개인정보 처리방침 페이지 (`/privacy`) — 법무 검토 완료
- [ ] 이용약관 페이지 (`/terms`) — 법무 검토 완료
- [ ] 수집 항목: 별명, 성별, 생년월일만 수집 확인 (ADR-011 실명 수집 금지)
- [ ] LLM 전송 데이터 PII 제로 확인 (AGENTS.md §5 ZDR)
- [ ] 회원 탈퇴 시 데이터 삭제 플로우 구현 및 테스트

### Google Play Data Safety

- [ ] Data Safety 섹션 작성 완료 (수집 데이터 유형 명시)
- [ ] 개인정보 처리방침 URL 등록
- [ ] 암호화 전송 확인 (HTTPS 전용)

### TWA 서명 APK

- [ ] Bubblewrap 빌드 성공 (`docs/specs/ci_cd.md` §4 TWA 절차)
- [ ] `assetlinks.json` SHA-256 일치 확인
- [ ] Google Play Console 내부 테스트 트랙 배포 성공
- [ ] TWA 앱 실제 디바이스 smoke test PASS

### 출시 전 최종 게이트

- [ ] `/cso` 보안 감사 PASS
- [ ] `/review` PR 최종 검토 PASS
- [ ] 토스페이먼츠 라이브 키 교체 완료 (`docs/specs/payments.md` §7)
- [ ] Sentry Production 에러 알림 설정 완료
- [ ] Discord 알림 채널 연결 완료 (`docs/specs/monitoring.md` §4)
- [ ] `/canary` 배포 후 5분 모니터링 PASS
- [ ] 제품 분석 도구 도입 시 개인정보처리방침·위탁처리자 목록 동시 갱신

---

## ADR-018 모트 자산 (G0 필수)

> ADR-018: 모트 = 명리 정확성 자산. KASI Agreement + 다중 검증 + 고전 RAG.

| 자산 항목 | 충족 기준 | 확인 시점 |
|---|---|---|
| KASI Agreement | 검증 코퍼스 100샘플, 일치율 > 98% | G0 |
| 다중 검증 기록 | ssaju + manseryeok-js 불일치 케이스 분류 | G0 |
| 고전 RAG 데이터셋 | 출처 목록 확정 + 초안 데이터셋 태그 | G0 |
| 이론 프로필 버전 | `profile_version` 태그 + ADR 기록 | G3 |
| 고전 인용 100% | 합카드 evidence 필수 포함 | G4 |

---

## 게이트 통과 기록 형식

각 게이트 통과 시 `docs/adr/` 또는 `MEMORY.md` 에 아래 형식으로 기록:

```
게이트: G0
통과 날짜: YYYY-MM-DD
측정값:
  - KASI Agreement: 98.X%
  - ssaju/manseryeok-js 일치율: XX%
  - 검증 샘플 수: XXX
확인자: (사용자 승인 날짜)
비고:
```
