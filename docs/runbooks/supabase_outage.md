# supabase_outage.md — Supabase 장애 대응 런북

---

## 1. 트리거 조건

- Supabase health check 실패 (DB 연결 불가)
- Auth API 응답 없음 (로그인 불가)
- Edge Function timeout > 30초
- https://status.supabase.com 장애 표시

---

## 2. 즉각 대응 (5분 내)

1. https://status.supabase.com 확인
2. Supabase Dashboard > DB 연결 상태 확인
3. **읽기 전용 모드 선언** (Next.js Middleware에서 write 차단):
   ```
   Vercel 환경 변수: SUPABASE_READ_ONLY=true
   → DB write 시도 시 즉시 503 반환
   ```
4. 비상 공지 배너 활성화:
   ```
   현재 데이터 저장 서비스 점검 중입니다.
   새로운 결과 생성이 일시 중단됩니다.
   ```
5. **캐시된 데이터 서빙**: 이미 로드된 hapcards/daily_haps는 브라우저 캐시에서 표시 가능
6. Sentry 알림 확인 및 DB write 의존 작업 일시 중단

---

## 3. 유저 경험 영향

- 로그인/가입: 불가 (Supabase Auth 의존)
- 기존 세션 유지: 쿠키 기반으로 단기간 유지 가능
- 새 결과 생성: 불가
- 이전 결과 조회: 브라우저 캐시에 있으면 표시

---

## 4. 복구 절차

1. status.supabase.com "Resolved" 확인
2. `SUPABASE_READ_ONLY` 환경 변수 제거
3. DB 연결 테스트: `select 1` 쿼리
4. Edge Function 정상 응답 확인
5. 비상 공지 배너 OFF
6. 장애 기간 중 실패한 요청 재처리 여부 검토 (필요 시 수동)

---

## 5. 사후 처리

- Supabase Point-in-Time Recovery 데이터 손실 여부 확인
- Free 플랜 한도 초과 여부 점검 (DB size, Edge Function invocations)
- Phase 1 출시 즉시 Pro 플랜 업그레이드 검토 ($25/월, PITR 7일)
- `incident_template.md` 사용하여 포스트모텀 작성
