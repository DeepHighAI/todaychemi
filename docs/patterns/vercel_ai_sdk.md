# vercel_ai_sdk.md — Vercel AI SDK 스트리밍 패턴

> **패키지**: `ai` v4+, `openai` v4.70+
> **용도**: hapcard 생성 스트리밍, daily_hap 생성

---

## 1. Route Handler (서버 → 클라이언트 SSE)

```typescript
// app/api/interpret/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@/lib/supabase/server';
import { stripPIIForLLM } from '@/lib/llm/sanitize';

export const maxDuration = 30;  // 30초 타임아웃

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = await request.json();
  const payload = stripPIIForLLM(body);  // PII 제거 (pii_minimization.md)

  // 프롬프트 버전 조회
  const { data: promptVersion } = await supabase
    .from('prompt_versions')
    .select('content, version')
    .eq('prompt_name', 'hapcard_main')
    .eq('status', 'active')
    .single();

  const result = streamText({
    model: openai('gpt-5'),  // OpenAI 4-tier: 핵심 해석은 gpt-5
    system: promptVersion?.content ?? '',
    messages: [
      {
        role: 'user',
        content: JSON.stringify(payload),
      },
    ],
    maxTokens: 1000,
  });

  return result.toDataStreamResponse();
}
```

---

## 2. Client Component (스트리밍 수신)

```typescript
// components/hapcard/HapcardGenerator.tsx
'use client';

import { useState } from 'react';
import { readStreamableValue } from 'ai/rsc';

export function HapcardGenerator({ relationId, mode }: Props) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function generate() {
    setIsLoading(true);
    setContent('');

    const response = await fetch('/api/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relationId, mode }),
    });

    if (!response.ok) {
      // 에러 처리 (errors.md 참조)
      setIsLoading(false);
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      setContent(prev => prev + decoder.decode(value));
    }

    setIsLoading(false);
  }

  return (
    <div>
      {isLoading && <SkeletonLoader />}
      {content && <HapcardContent content={content} />}
      <button onClick={generate} disabled={isLoading}>
        합카드 생성
      </button>
    </div>
  );
}
```

---

## 3. 모델 선택 가이드

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// OpenAI 4-tier
const MODELS = {
  hapcard: openai('gpt-5'),         // 핵심 관계 해석
  deep_hap: openai('gpt-5'),         // 딥합 (장문 심층)
  daily_hap: openai('gpt-5-mini'),   // 오늘합 (짧고 반복적)
  judge: openai('gpt-5-mini'),       // LLM-as-judge (CI)
  fallback: anthropic(process.env.ANTHROPIC_FALLBACK_MODEL ?? 'claude-sonnet-4-5'),  // 장애 시에만
} as const;
```

---

## 4. 스트리밍 로딩 UX 연동

스트리밍 중 섹션별 점진 표시 (fortune_architecture.md §9.6.1):
- 0초: 스켈레톤 + "AI가 해석 중이에요..."
- 2초: main_text 첫 줄 fade-in
- 4초: cause_factors 3개
- 6초: classic_citation 카드
- 8초: actions 3개
- 10초+: "조금 더 걸리고 있어요" 보조 문구
- 20초: LLM_TIMEOUT 에러 전환
