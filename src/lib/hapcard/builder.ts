import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChartCore, ChartHash } from '@/types/chart';
import type { Mode } from '@/types/mode';
import type { HapcardResult } from '@/types/hapcard';
import { computeScore } from '@/lib/scoring/index';
import { loadActivePrompt } from '@/lib/llm/prompt-loader';
import { deriveCacheKey } from '@/lib/hapcard/cache-key';
import { buildLlmPayload } from '@/lib/llm/payload';
import { embedQuery } from '@/lib/rag/embeddings';
import { retrieveClassics } from '@/lib/rag/classics';
import { callOpenAi, type CallOpenAiDeps } from '@/lib/llm/openai';
import { validateClassicCitations } from '@/lib/rag/grounding-validator';

export interface BuildHapcardInput {
  user_id: string;
  relation_id: string;
  mode: Mode;
  self: ChartCore;
  self_chart_hash: ChartHash;
  relation: ChartCore;
  relation_chart_hash: ChartHash;
  theory_profile_version: string;
  question_slot?: string;
}

export interface BuildHapcardDeps {
  supabaseUserClient: SupabaseClient;
  supabaseServiceClient: SupabaseClient;
  openaiClient: CallOpenAiDeps['openaiClient'];
  embeddingsClient: {
    create: (params: { model: string; input: string }) => Promise<{
      data: Array<{ embedding: number[] }>;
    }>;
  };
  ragQueryText: (input: BuildHapcardInput) => string;
}

export async function buildHapcard(
  input: BuildHapcardInput,
  deps: BuildHapcardDeps,
): Promise<HapcardResult> {
  // 1. 결정형 점수 — ADR-035, LLM 점수 개입 금지
  const scoreOutput = computeScore({
    self: input.self,
    relation: input.relation,
    mode: input.mode,
  });

  // 2. active prompt 로드 (supabaseUserClient — status='active' 단일 행)
  const prompt = await loadActivePrompt(deps.supabaseUserClient, input.mode);

  // 3. cache key 파생
  const cacheKey = deriveCacheKey({
    user_chart_hash: input.self_chart_hash,
    relation_chart_hash: input.relation_chart_hash,
    mode: input.mode,
    prompt_version: prompt.version,
    theory_profile_version: input.theory_profile_version,
  });

  // 4. cache lookup — hit 이면 즉시 반환
  const cacheRes = await deps.supabaseUserClient
    .from('hapcards')
    .select('*')
    .eq('cache_key', cacheKey)
    .maybeSingle();
  if (cacheRes.error) {
    throw new Error(`HAPCARD_CACHE_LOOKUP_FAILED: ${cacheRes.error.message}`);
  }
  if (cacheRes.data) return cacheRes.data as HapcardResult;

  // 5. LLM payload 빌드 (PII 5필드 제외 — CLAUDE.md §5)
  const payload = buildLlmPayload({
    self: input.self,
    relation: input.relation,
    mode: input.mode,
    theory_profile_version: input.theory_profile_version,
    question_slot: input.question_slot,
  });

  // 6. RAG retrieval
  const queryText = deps.ragQueryText(input);
  const queryVec = await embedQuery(queryText, { embeddings: deps.embeddingsClient });
  const ragHits = await retrieveClassics(deps.supabaseServiceClient, queryVec);

  // 7. system prompt 조합
  const systemPrompt = `${prompt.content}\n\n${JSON.stringify(ragHits, null, 2)}`;

  // 8. LLM 호출 + grounding 검증 (최대 1회 재시도)
  const callDeps = {
    openaiClient: deps.openaiClient,
    supabaseServiceRole: deps.supabaseServiceClient,
  };
  let llmResult = await callOpenAi({ systemPrompt, userPayload: payload }, callDeps);
  let grounding = validateClassicCitations(
    { classic_citation: llmResult.output.classic_citation },
    ragHits,
  );
  if (!grounding.valid) {
    llmResult = await callOpenAi({ systemPrompt, userPayload: payload }, callDeps);
    grounding = validateClassicCitations(
      { classic_citation: llmResult.output.classic_citation },
      ragHits,
    );
    if (!grounding.valid) {
      throw new Error(`GROUNDING_FAILED: ${JSON.stringify(grounding.errors)}`);
    }
  }

  // 9. LLM classic_citation 형식 → HapcardResult.content.classic_citation 형식 변환
  const content: HapcardResult['content'] = {
    main_text: llmResult.output.main_text,
    cause_factors: llmResult.output.cause_factors,
    classic_citation: llmResult.output.classic_citation.map((c) => ({
      source: `${(c as Record<string, unknown>).source_title ?? ''} ${(c as Record<string, unknown>).source_chapter ?? ''}`.trim(),
      original: ((c as Record<string, unknown>).original_text as string) ?? '',
      modern: ((c as Record<string, unknown>).modern_translation as string) ?? '',
    })),
    actions: llmResult.output.actions,
    why_cards: llmResult.output.why_cards,
  };

  // 10. INSERT → HapcardResult 반환
  const insertRes = await deps.supabaseUserClient
    .from('hapcards')
    .insert({
      user_id: input.user_id,
      relation_id: input.relation_id,
      mode: input.mode,
      compat_score: scoreOutput.score,
      score_breakdown: {
        hap_chung_hyung_hae: scoreOutput.components.hap_chung_hyung_hae,
        sipsin: scoreOutput.components.sipsin,
        ohaeng: scoreOutput.components.ohaeng,
        mode_adjustment: scoreOutput.mode_adjustment,
      },
      content,
      prompt_version: prompt.version,
      llm_model: 'gpt-5o',
      cache_key: cacheKey,
      user_chart_hash: input.self_chart_hash,
      relation_chart_hash: input.relation_chart_hash,
      archived_at: null,
      version_label: null,
    })
    .select()
    .single();

  if (insertRes.error) {
    throw new Error(`HAPCARD_INSERT_FAILED: ${insertRes.error.message}`);
  }
  return insertRes.data as HapcardResult;
}
