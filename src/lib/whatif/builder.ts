import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChartCore, ChartHash } from '@/types/chart';
import type { DiagnosticType, WhatifResult, WhatifContent } from '@/types/diagnostic';
import { WhatifLlmOutputSchema } from '@/lib/whatif/output-schema';
import { loadWhatifPrompt } from '@/lib/whatif/prompt-loader';
import { DEFAULT_LLM_MODEL } from '@/lib/llm/constants';
import { deriveCacheKey } from '@/lib/whatif/cache-key';
import { embedQuery } from '@/lib/rag/embeddings';
import { retrieveClassics } from '@/lib/rag/classics';
import { callOpenAi, type CallOpenAiDeps } from '@/lib/llm/openai';
import { validateClassicCitations } from '@/lib/rag/grounding-validator';

export interface BuildWhatifResult {
  result: WhatifResult;
  fromCache: boolean;
}

export interface BuildWhatifInput {
  user_id: string;
  type: DiagnosticType;
  chart: ChartCore;
  chart_hash: ChartHash;
}

export interface BuildWhatifDeps {
  supabaseUserClient: SupabaseClient;
  supabaseServiceClient: SupabaseClient;
  openaiClient: CallOpenAiDeps['openaiClient'];
  embeddingsClient: {
    create: (params: { model: string; input: string }) => Promise<{
      data: Array<{ embedding: number[] }>;
    }>;
  };
  ragQueryText: (input: BuildWhatifInput) => string;
}

function mapDbRow(data: unknown): WhatifResult {
  const r = data as {
    whatif_id: string;
    user_id: string;
    type: DiagnosticType;
    content: WhatifContent;
    prompt_version: string;
    llm_model: string;
    cache_key: string;
    chart_hash: string;
    created_at: string;
  };
  return {
    id: r.whatif_id,
    user_id: r.user_id,
    type: r.type,
    content: r.content,
    prompt_version: r.prompt_version,
    llm_model: r.llm_model,
    cache_key: r.cache_key,
    chart_hash: r.chart_hash,
    created_at: r.created_at,
  };
}

export async function buildWhatif(
  input: BuildWhatifInput,
  deps: BuildWhatifDeps,
): Promise<BuildWhatifResult> {
  // 1. 프롬프트 로드
  const prompt = loadWhatifPrompt(input.type);

  // 2. 캐시 키 파생
  const cacheKey = deriveCacheKey({
    chart_hash: input.chart_hash,
    type: input.type,
    prompt_version: prompt.version,
  });

  // 3. 캐시 조회 — 히트 시 즉시 반환
  const cacheRes = await deps.supabaseUserClient
    .from('whatif_results')
    .select('*')
    .eq('cache_key', cacheKey)
    .maybeSingle();
  if (cacheRes.data) {
    return { result: mapDbRow(cacheRes.data), fromCache: true };
  }

  // 4. RAG retrieval
  const queryText = deps.ragQueryText(input);
  const queryVec = await embedQuery(queryText, { embeddings: deps.embeddingsClient });
  const ragHits = await retrieveClassics(deps.supabaseServiceClient, queryVec);

  // 5. system prompt 조합
  const systemPrompt = `${prompt.content}\n\n${JSON.stringify(ragHits, null, 2)}`;

  // 6. PII payload (CLAUDE.md §5 — self_chart_core + type만 허용)
  const userPayload = { self_chart_core: input.chart, type: input.type };
  const payloadWhitelist = new Set(['self_chart_core', 'type']);

  // 7. LLM 호출 + grounding 검증 (최대 1회 재시도)
  const callDeps = {
    openaiClient: deps.openaiClient,
    supabaseServiceRole: deps.supabaseServiceClient,
  };
  const callInput = {
    systemPrompt,
    userPayload,
    schema: WhatifLlmOutputSchema,
    payloadWhitelist,
    model: DEFAULT_LLM_MODEL,
  };

  // validateClassicCitations는 HapcardLlmOutput 타입으로 정의되어 있으나 runtime 사용 필드는 동일 — 안전한 캐스트
  type GroundingArg = Parameters<typeof validateClassicCitations>[0];

  let llmResult = await callOpenAi(callInput, callDeps);
  let grounding = validateClassicCitations(
    { classic_citation: (llmResult.output.classic_citation ?? []) as GroundingArg['classic_citation'] },
    ragHits,
  );
  if (!grounding.valid) {
    llmResult = await callOpenAi(callInput, callDeps);
    grounding = validateClassicCitations(
      { classic_citation: (llmResult.output.classic_citation ?? []) as GroundingArg['classic_citation'] },
      ragHits,
    );
    if (!grounding.valid) {
      throw new Error(`GROUNDING_FAILED: ${JSON.stringify(grounding.errors)}`);
    }
  }

  // 8. INSERT — D4 race: 23505 → re-SELECT
  const insertRow = {
    user_id: input.user_id,
    type: input.type,
    content: {
      body: llmResult.output.body,
      keywords: llmResult.output.keywords,
      do_first: llmResult.output.do_first,
      ...(llmResult.output.first_meet_tips && { first_meet_tips: llmResult.output.first_meet_tips }),
      ...(llmResult.output.classic_citation?.length && { classic_citation: llmResult.output.classic_citation }),
    } satisfies WhatifContent,
    prompt_version: prompt.version,
    llm_model: DEFAULT_LLM_MODEL,
    cache_key: cacheKey,
    chart_hash: input.chart_hash,
  };
  const insertRes = await deps.supabaseUserClient
    .from('whatif_results')
    .insert(insertRow)
    .select()
    .single();

  if (insertRes.error) {
    if ((insertRes.error as { code?: string }).code === '23505') {
      const retry = await deps.supabaseUserClient
        .from('whatif_results')
        .select('*')
        .eq('cache_key', cacheKey)
        .maybeSingle();
      if (retry.data) return { result: mapDbRow(retry.data), fromCache: false };
      throw new Error('WHATIF_INSERT_FAILED: race recovery missed');
    }
    throw new Error(`WHATIF_INSERT_FAILED: ${insertRes.error.message}`);
  }

  return { result: mapDbRow(insertRes.data), fromCache: false };
}
