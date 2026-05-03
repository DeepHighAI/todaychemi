# api_key_rotation.md — API 키 로테이션 런북

> **주기**: 분기 1회 정기 + 누출 의심 시 즉시
> **원칙**: 신구 키를 동시에 5분 이상 활성 상태로 유지 금지

---

## 1. 로테이션 대상 키

| 키 | 위치 | 주기 |
|---|---|---|
| OpenAI API Key (Prod) | Vercel Env + Supabase Secrets | 분기 1회 |
| OpenAI API Key (Staging) | Vercel Env + Supabase Secrets | 분기 1회 |
| OpenAI API Key (CI-Regression) | GitHub Secrets | 분기 1회 |
| Anthropic API Key | Vercel Env + Supabase Secrets | 분기 1회 |
| Supabase Service Role Key | Vercel Env | 분기 1회 |
| KASI API Key | Vercel Env | 분기 1회 |
| Toss Payments Secret Key | Vercel Env (Phase 2+) | 분기 1회 |

---

## 2. 4단계 로테이션 절차

### Step 1: 신규 키 발급

- OpenAI: platform.openai.com → API keys → Create new key
- Anthropic: console.anthropic.com → API Keys → Create key
- Supabase: project settings → API → Service Role → Reset
- KASI: KASI Open API 포털에서 재발급

### Step 2: Vercel 환경 변수 업데이트

```
Vercel Dashboard → Project → Settings → Environment Variables
신규 값으로 업데이트 (Prod / Preview / Development 각각)
```

Supabase Edge Function Secrets도 별도 업데이트:
```
Supabase Dashboard → Project → Edge Functions → Secrets
```

### Step 3: 동작 검증 (신규 키 적용 후 5분 내)

```bash
# Vercel 재배포 후 헬스체크
curl https://<domain>/api/health

# LLM 엔드포인트 테스트 (Staging 먼저)
curl -X POST https://staging.<domain>/api/interpret \
  -H "Authorization: Bearer <test-token>"
```

정상 응답 확인 후 즉시 Step 4 진행.

### Step 4: 구 키 revoke

- OpenAI: platform.openai.com → API keys → Delete old key
- Anthropic: console.anthropic.com → API Keys → Revoke old key
- Supabase: Service Role은 Reset 시 자동 무효화
- **신구 키 동시 활성 상태 5분 이상 유지 금지**

---

## 3. 긴급 로테이션 (누출 의심 시)

누출 의심 발견 즉시:
1. 위 절차를 순서대로 실행 (Step 1 → 4, 최대한 빠르게)
2. `llm_cost_tracking` 테이블에서 비정상 호출 확인
3. `anon_requests` 테이블에서 IP 패턴 확인
4. 이상 호출 발견 시 사용자에게 즉시 보고

---

## 4. 기록

로테이션 완료 후 배포 로그 또는 `reports/key_rotation_YYYY-MM-DD.md`에 기록:
- 날짜, 대상 키, 사유 (정기/누출), 담당자
