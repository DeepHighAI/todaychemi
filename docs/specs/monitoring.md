# Monitoring Spec

> 본 문서는 Free tier 알림 임계값, /admin/sre 대시보드, 카나리·벤치마크 SOP를 기술한다.
> 배포 후 모니터링은 CLAUDE.md §10 검증 스킬 매핑의 `/canary`, `/benchmark` 참조.

---

## 1. Free Tier 알림 임계값

### Vercel Hobby Plan

| 지표 | 한도 | 알림 임계값 | 알림 채널 |
|---|---|---|---|
| 대역폭 | 100 GB/월 | 80 GB (80%) | Discord #alerts |
| Serverless Function 실행 | 100,000 req/일 | 80,000 req/일 (80%) | Discord #alerts |
| Build minutes | 6,000 min/월 | 5,000 min (83%) | Discord #alerts |

**확인 방법**: Vercel 대시보드 → Usage 탭 (매주 수동 확인 또는 Vercel webhook 연동)

### Supabase Free Plan

| 지표 | 한도 | 알림 임계값 | 알림 채널 |
|---|---|---|---|
| DB 크기 | 500 MB | 400 MB (80%) | Discord #alerts |
| Storage | 1 GB | 800 MB (80%) | Discord #alerts |
| 월간 활성 사용자 | 50,000 MAU | 40,000 MAU (80%) | Discord #alerts |
| 에지 함수 호출 | 500,000 req/월 | 400,000 req/월 (80%) | Discord #alerts |

**확인 방법**: Supabase 대시보드 → Project Settings → Usage

### Sentry Free Plan

| 지표 | 한도 | 알림 임계값 | 알림 채널 |
|---|---|---|---|
| 에러 이벤트 | 5,000 req/월 | 4,000 req/월 (80%) | Discord #alerts + Sentry issue |
| 성능 트랜잭션 | 10,000 req/월 | 8,000 req/월 (80%) | Discord #alerts |

**확인 방법**: Sentry 대시보드 → Organization → Usage & Billing

### OpenAI 일일 예산

| 지표 | 한도 | 조치 |
|---|---|---|
| 일일 LLM 비용 | $20 (환경변수 `LLM_DAILY_BUDGET_USD`) | 즉시 fallback 차단 + Discord #critical ping |

**작동 방식**:

```typescript
// LLM 비용 추적 미들웨어
async function checkDailyBudget(): Promise<void> {
  const { data } = await supabase
    .from('llm_usage_log')
    .select('cost_usd')
    .gte('created_at', startOfDayISO())
    .single();

  const totalCost = data?.cost_usd ?? 0;
  const budget = Number(process.env.LLM_DAILY_BUDGET_USD ?? 20);

  if (totalCost >= budget) {
    // Discord #critical 알림 전송
    await notifyDiscord({ level: 'critical', message: `LLM 일일 예산 초과: $${totalCost}` });
    throw new Error('LLM_ALL_PROVIDERS_DOWN');  // 503 응답
  }
}
```

---

## 2. /admin/sre 대시보드 — 4개 패널

접근 제어: `app_metadata.role === 'admin'` (CLAUDE.md §api_routes.md §8)

### 패널 1: LLM 비용 (Cost)

- **표시 지표**: 오늘 누적 비용 ($), 이번 달 누적 비용 ($), 예산 소진율 (%)
- **갱신 주기**: 1분
- **데이터 소스**: `llm_usage_log` 테이블

```sql
-- llm_usage_log 테이블 구조
SELECT
  model_name,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cost_usd) AS total_cost_usd,
  COUNT(*) AS request_count,
  DATE(created_at) AS date
FROM llm_usage_log
GROUP BY model_name, DATE(created_at)
ORDER BY date DESC, total_cost_usd DESC;
```

- **시각화**: 일별 비용 막대 차트 (마지막 30일), 모델별 비율 파이 차트

### 패널 2: 에러율 (Error Rate)

- **표시 지표**: 분당 에러율 (%), 에러 코드별 빈도, Sentry 이슈 링크
- **갱신 주기**: 30초
- **데이터 소스**: `error_log` 테이블 + Sentry API

```sql
-- 최근 1시간 에러율
SELECT
  error_code,
  COUNT(*) AS error_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS error_pct
FROM error_log
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY error_code
ORDER BY error_count DESC;
```

- **알림 조건**: 에러율 > 5% 시 Discord #alerts 자동 ping

### 패널 3: OpenAI / Anthropic 분할 (Provider Split)

- **표시 지표**: 요청수 기준 OpenAI vs Anthropic 비율, fallback 발생 횟수
- **갱신 주기**: 5분
- **데이터 소스**: `llm_usage_log.model_name`

```typescript
// 모델명 → 공급자 분류
function classifyProvider(modelName: string): 'openai' | 'anthropic' {
  if (modelName.startsWith('gpt-') || modelName.startsWith('o')) return 'openai';
  if (modelName.startsWith('claude-')) return 'anthropic';
  return 'openai';  // 기본값
}
```

- **알림 조건**: Anthropic fallback 비율 > 20% 시 → OpenAI 장애 의심, Discord #critical

### 패널 4: 금지 어구 비율 (Banned Phrase Ratio)

- **표시 지표**: 오늘 banned_phrase 히트수 / 전체 LLM 응답수 (%), 어구별 히트 목록
- **갱신 주기**: 10분
- **데이터 소스**: `banned_phrase_hits` 테이블

```sql
-- 오늘 금지 어구 비율
SELECT
  bph.phrase,
  COUNT(*) AS hit_count,
  pv.version_label AS prompt_version
FROM banned_phrase_hits bph
JOIN prompt_versions pv ON bph.prompt_version_id = pv.id
WHERE bph.created_at >= CURRENT_DATE
GROUP BY bph.phrase, pv.version_label
ORDER BY hit_count DESC;
```

- **알림 조건**: banned_phrase 비율 > 3% 시 → 해당 프롬프트 버전 즉시 rolled_back 검토 (G2 게이트, `docs/specs/definition_of_done.md`)

---

## 3. 카나리 배포 SOP (/canary 스킬)

### 카나리 적용 대상

- 새 프롬프트 버전 (prompt_versions.canary_pct 설정)
- LLM 모델 변경
- 점수 결정형 로직 변경 (ADR-035)

### 카나리 절차

1. `prompt_versions` INSERT: `canary_pct = 10`, `status = 'canary'`
2. `/canary` 스킬 실행 — 5분 모니터링
3. 지표 확인:
   - 에러율 변화 < 1%
   - banned_phrase 비율 변화 없음
   - LLM 응답 시간 p95 < 8초
4. PASS → `canary_pct` 25 → 50 → 100 단계적 증가
5. FAIL → `status = 'rolled_back'`, 이전 버전 `status = 'active'` 복원
6. 결과를 CLAUDE.md §13 메모 위치에 기록

### /benchmark 스킬 SOP

배포 후 Lighthouse 회귀 탐지:

```
목표값 (G1 게이트 기준, docs/specs/definition_of_done.md):
- Lighthouse Performance: ≥ 90
- CLS (Cumulative Layout Shift): < 0.1
- LCP (Largest Contentful Paint): < 2.5s
- FCP (First Contentful Paint): < 1.8s
```

- 회귀 감지 임계값: Performance -5점 이상 하락, LCP +0.5s 이상 증가
- 회귀 시 배포 자동 rollback 권고 + Discord #alerts

---

## 4. Discord 알림 설정

### 채널 구성

| 채널 | 용도 |
|---|---|
| `#alerts` | 임계값 초과 경고 (80% 도달) |
| `#critical` | 즉각 조치 필요 (예산 초과, 모든 LLM 다운, 서명 오류) |
| `#deploys` | Vercel 배포 성공/실패 알림 |
| `#llm-costs` | 일일 비용 리포트 (00:00 KST 자동 전송) |

### Discord Webhook 연동

```typescript
// lib/notify.ts
async function notifyDiscord({
  channel,
  level,
  message,
}: {
  channel: 'alerts' | 'critical' | 'deploys' | 'llm-costs';
  level: 'info' | 'warning' | 'critical';
  message: string;
}): Promise<void> {
  const webhookUrl = process.env[`DISCORD_WEBHOOK_${channel.toUpperCase()}`];
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        color: level === 'critical' ? 0xff0000 : level === 'warning' ? 0xffaa00 : 0x00ff00,
        description: message,
        timestamp: new Date().toISOString(),
      }],
    }),
  });
}
```
