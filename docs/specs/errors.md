# Error Code Matrix

> 본 문서는 에러 코드 전체 목록, HTTP 상태, UX 처리, 재시도 정책, Sentry 수집 여부를 정의한다.
> API 라우트 에러 응답 형식은 `docs/specs/api_routes.md` §3 참조.

---

## 1. 에러 코드 매트릭스

| Code | HTTP | UX 처리 | 재시도 | Sentry |
|---|---|---|---|---|
| `LLM_TIMEOUT` | 504 | "잠시 후 다시 해주세요" 토스트 | 1회 자동 재시도 | yes |
| `LLM_BANNED_PHRASE` | 422 | 자동 tone-correct 후 재시도 (UX 노출 없음) | 자동 | yes |
| `LLM_ALL_PROVIDERS_DOWN` | 503 | "일시 점검 중" 배너 + 캐시 데이터 표시 | 없음 | critical |
| `INSUFFICIENT_TOKENS` | 402 | 결제 시트 자동 열기 (Payment Widget) | 없음 | no |
| `INVALID_CHART` | 400 | 입력 폼으로 복귀 + 오류 필드 하이라이트 | 없음 | yes |
| `RLS_DENIED` | 403 | "접근 권한 없음" 토스트 | 없음 | yes |
| `LEGAL_CONSENT_REQUIRED` | 403 | 회원가입/로그인 동의 단계로 복귀 | 없음 | no |
| `RATE_LIMITED` | 429 | "잠시 후 다시 해주세요" + 카운트다운 | 지수 백오프 | yes |
| `INTERNAL` | 500 | "오류가 발생했어요" + 피드백 버튼 | 없음 | critical |

---

## 2. Zod 에러 스키마

```typescript
import { z } from 'zod';

// 에러 코드 열거형
export const ErrorCodeSchema = z.enum([
  'LLM_TIMEOUT',
  'LLM_BANNED_PHRASE',
  'LLM_ALL_PROVIDERS_DOWN',
  'INSUFFICIENT_TOKENS',
  'INVALID_CHART',
  'RLS_DENIED',
  'LEGAL_CONSENT_REQUIRED',
  'RATE_LIMITED',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

// API 에러 응답 스키마
export const ApiErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),              // 사용자 표시용 한국어 메시지
  detail: z.unknown().optional(),   // 디버그용 (production에서 omit)
  retry_after: z.number().optional(), // RATE_LIMITED 시 초 단위 대기
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// 유효성 검사 에러 (Zod validation 실패 시)
export const ValidationErrorSchema = z.object({
  code: z.literal('INVALID_CHART'),
  message: z.string(),
  fields: z.record(z.string(), z.string()),  // { fieldName: errorMessage }
});
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
```

---

## 3. 에러 생성 헬퍼

```typescript
// lib/errors.ts

import type { ErrorCode, ApiError } from '@/types/errors';
import { NextResponse } from 'next/server';

// 에러 코드 → HTTP 상태코드 매핑
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  LLM_TIMEOUT: 504,
  LLM_BANNED_PHRASE: 422,
  LLM_ALL_PROVIDERS_DOWN: 503,
  INSUFFICIENT_TOKENS: 402,
  INVALID_CHART: 400,
  RLS_DENIED: 403,
  LEGAL_CONSENT_REQUIRED: 403,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

// 에러 코드 → 사용자 메시지 (KO)
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  LLM_TIMEOUT: '잠시 후 다시 해주세요.',
  LLM_BANNED_PHRASE: '결과를 다듬고 있어요. 잠시만 기다려주세요.',
  LLM_ALL_PROVIDERS_DOWN: '일시적으로 점검 중이에요. 잠시 후 다시 시도해주세요.',
  INSUFFICIENT_TOKENS: '포인트가 부족해요. 충전 후 이용해주세요.',
  INVALID_CHART: '입력한 정보를 다시 확인해주세요.',
  RLS_DENIED: '접근 권한이 없어요.',
  LEGAL_CONSENT_REQUIRED: '이용약관과 개인정보처리방침 동의가 필요해요.',
  RATE_LIMITED: '잠시 후 다시 해주세요.',
  INTERNAL: '오류가 발생했어요. 계속되면 피드백을 남겨주세요.',
};

export function createApiErrorResponse(
  code: ErrorCode,
  options?: { detail?: unknown; retryAfter?: number }
): NextResponse {
  const body: ApiError = {
    code,
    message: ERROR_MESSAGES[code],
    ...(process.env.NODE_ENV !== 'production' && options?.detail !== undefined
      ? { detail: options.detail }
      : {}),
    ...(options?.retryAfter !== undefined ? { retry_after: options.retryAfter } : {}),
  };

  const headers: Record<string, string> = {};
  if (options?.retryAfter !== undefined) {
    headers['Retry-After'] = String(options.retryAfter);
  }

  return NextResponse.json(body, {
    status: ERROR_STATUS_MAP[code],
    headers,
  });
}
```

---

## 4. 재시도 정책

### LLM_TIMEOUT — 자동 1회 재시도

```typescript
// lib/llm/withRetry.ts
const LLM_TIMEOUT_MS = 20_000;   // 20초
const MAX_RETRIES = 1;

async function callLlmWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM_TIMEOUT')), LLM_TIMEOUT_MS)
        ),
      ]);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        // 다음 provider로 폭포식 이동 (api_routes.md §6 참조)
        continue;
      }
    }
  }

  throw lastError;
}
```

### RATE_LIMITED — 지수 백오프 (클라이언트)

```typescript
// lib/client/withBackoff.ts
const INITIAL_DELAY_MS = 1_000;
const MAX_DELAY_MS = 32_000;
const MAX_ATTEMPTS = 5;

async function fetchWithBackoff(
  url: string,
  init?: RequestInit
): Promise<Response> {
  let delay = INITIAL_DELAY_MS;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, init);

    if (res.status !== 429) return res;

    const retryAfter = Number(res.headers.get('Retry-After') ?? delay / 1000);
    const waitMs = Math.min(retryAfter * 1000, MAX_DELAY_MS);

    await new Promise(resolve => setTimeout(resolve, waitMs));
    delay = Math.min(delay * 2, MAX_DELAY_MS);
  }

  throw new Error('RATE_LIMITED: max attempts exceeded');
}
```

---

## 5. UX 에러 처리 컴포넌트 패턴

### 토스트 에러 처리

```typescript
// 클라이언트 컴포넌트에서 에러 처리
import { toast } from '@/components/ui/use-toast';
import type { ApiError } from '@/types/errors';

function handleApiError(error: ApiError): void {
  switch (error.code) {
    case 'INSUFFICIENT_TOKENS':
      // 결제 시트 자동 열기
      openPaymentSheet();
      break;
    case 'RATE_LIMITED':
      toast({
        title: error.message,
        description: error.retry_after
          ? `${error.retry_after}초 후 다시 시도해주세요.`
          : undefined,
        variant: 'destructive',
      });
      break;
    case 'LLM_ALL_PROVIDERS_DOWN':
      // 전체 배너 표시
      setMaintenanceBanner(true);
      break;
    default:
      toast({ title: error.message, variant: 'destructive' });
  }
}
```

### Error Boundary (React)

```typescript
// app/error.tsx (Next.js App Router 에러 경계)
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <p className="text-destructive">오류가 발생했어요.</p>
      <button onClick={reset}>다시 시도</button>
      <a href="/feedback">피드백 보내기</a>
    </div>
  );
}
```

---

## 6. Sentry 수집 정책

### critical 에러 — 즉각 알림

```typescript
import * as Sentry from '@sentry/nextjs';

// INTERNAL, LLM_ALL_PROVIDERS_DOWN
Sentry.captureException(error, {
  level: 'fatal',
  tags: { error_code: 'INTERNAL' },
});
```

### yes 에러 — 수집 (알림 없음)

```typescript
// LLM_TIMEOUT, LLM_BANNED_PHRASE, INVALID_CHART, RLS_DENIED, RATE_LIMITED
Sentry.captureException(error, {
  level: 'error',
  tags: { error_code: errorCode },
  extra: { userId, route },
});
```

### no 에러 — 수집 안 함

```typescript
// INSUFFICIENT_TOKENS — 정상적인 비즈니스 흐름
// Sentry.captureException 호출하지 않음
// 단, payments 이상 패턴은 Discord #critical 알림
```

### Sentry 월간 에러 예산

5,000 이벤트/월 (Free tier). `docs/specs/monitoring.md` §1 임계값 참조.
4,000 이벤트 도달 시 중요도 낮은 이벤트 필터링 검토.
