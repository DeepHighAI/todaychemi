# vercel_outage.md — Vercel 장애 대응 런북

---

## 1. 트리거 조건

- https://vercel-status.com 또는 https://www.vercel-status.com 에서 Degraded / Outage 표시
- 사이트 접속 불가 (DNS 또는 CDN 레이어 장애)
- 배포 실패 (build 또는 serverless function 오류)

---

## 2. 즉각 대응 (5분 내)

1. https://vercel-status.com 상태 확인
2. 장애 범위 파악: Edge Network / Functions / 특정 Region
3. 직접 Vercel Dashboard 접속 → Deployments 탭에서 최근 배포 상태 확인
4. 유저에게 SNS 공지 (장애 30분 이상 지속 시)

---

## 3. Cloudflare Bypass 검토

Phase 3 전환 계획이 있는 Cloudflare로 임시 우회:
- Cloudflare Pages에 정적 "점검 중" 페이지 배포
- DNS CNAME을 Cloudflare로 임시 전환 (TTL: 60초로 낮춰두어야 빠름)
- **단**: DNS 전환은 10~30분 소요. 단기 장애(30분 미만)에는 적용 불필요.

---

## 4. 복구 절차

1. vercel-status.com "Resolved" 확인
2. 강제 재배포 트리거 (Vercel Dashboard > Deployments > Redeploy)
3. 헬스체크 엔드포인트 `/api/health` 응답 확인
4. Sentry 에러율 정상화 확인
5. DNS 임시 전환 했으면 원복

---

## 5. 예방 조치

- DNS TTL을 평소 300초로 유지 (빠른 전환 대비)
- Cloudflare "점검 중" 정적 페이지 미리 준비
- `incident_template.md`로 포스트모텀 작성
