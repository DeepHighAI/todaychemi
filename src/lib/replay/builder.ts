import { createHash } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ChartCore } from '@/types/chart';
import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';
import type { HapcardResult, HapcardReplayResult, LlmModel } from '@/types/hapcard';
import { callOpenAi, type CallOpenAiDeps } from '@/lib/llm/openai';
import { buildLlmPayload } from '@/lib/llm/payload';
import type { LlmPayload } from '@/lib/llm/payload';
import { loadActivePrompt } from '@/lib/llm/prompt-loader';
import { mapLlmCitation } from '@/lib/glossary/citation-mapper';
import {
  fetchLatestUserChartForVersion,
  fetchLatestRelationChartForVersion,
} from '@/lib/chart/queries';

const JINJIN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ReplayCacheKeyInput {
  user_chart_hash: string;
  relation_chart_hash: string;
  prompt_version: string;
  theory_profile_version: string;
  jinjin_date: string; // YYYY-MM-DD (UTC+9)
}

// spec §8: replay_cache_key = sha256(chart_hash | scoring_version | prompt_version | jinjin_date)
export function buildReplayCacheKey(input: ReplayCacheKeyInput): string {
  const payload =
    input.user_chart_hash +
    input.relation_chart_hash +
    input.prompt_version +
    input.theory_profile_version +
    input.jinjin_date;
  return createHash('sha256').update(payload).digest('hex');
}

// spec §10: 6모드 system prompt 첫 줄에 [재해석 모드 — 일진:YYYY-MM-DD] prepend
export function buildReplaySystemPrompt(systemPrompt: string, jinjin_date: string): string {
  if (!JINJIN_DATE_RE.test(jinjin_date)) {
    throw new Error(`INVALID_JINJIN_DATE: ${jinjin_date}`);
  }
  return `[재해석 모드 — 일진:${jinjin_date}]\n${systemPrompt}`;
}

// time_context 추가 (불변 — 원본 payload 변이 없음)
export function buildReplayPayload(
  payload: LlmPayload,
  jinjin_date: string,
): LlmPayload {
  return { ...payload, time_context: { jinjin_date } };
}

export interface BuildReplayInput {
  hapcard: HapcardResult;
  jinjin_date: string; // YYYY-MM-DD UTC+9
  replay_reason?: string;
}

export interface BuildReplayDeps {
  supabaseUserClient: SupabaseClient;
  supabaseServiceClient: SupabaseClient;
  openaiClient: CallOpenAiDeps['openaiClient'];
}

interface ChartRow {
  chart_core: ChartCore;
}

export async function buildReplay(
  input: BuildReplayInput,
  deps: BuildReplayDeps,
): Promise<HapcardReplayResult> {
  const { hapcard } = input;

  const prompt = await loadActivePrompt(deps.supabaseUserClient, hapcard.mode);

  const cacheKey = buildReplayCacheKey({
    user_chart_hash: hapcard.user_chart_hash,
    relation_chart_hash: hapcard.relation_chart_hash,
    prompt_version: prompt.version,
    theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
    jinjin_date: input.jinjin_date,
  });

  const replaySystemPrompt = buildReplaySystemPrompt(prompt.content, input.jinjin_date);

  // user_charts / relation_charts 는 독립 쿼리 — 병렬 fetch
  // MeEdit 시 신규 row INSERT (ADR-016 FK 보존) → fetchLatest*ForVersion 으로 latest 선택
  const [ucResult, rcResult] = await Promise.all([
    fetchLatestUserChartForVersion(
      deps.supabaseUserClient as Parameters<typeof fetchLatestUserChartForVersion>[0],
      hapcard.user_id,
      DEFAULT_THEORY_PROFILE_VERSION,
    ),
    fetchLatestRelationChartForVersion(
      deps.supabaseUserClient as Parameters<typeof fetchLatestRelationChartForVersion>[0],
      hapcard.relation_id,
      DEFAULT_THEORY_PROFILE_VERSION,
    ),
  ]);

  const { data: ucRow, error: ucErr } = ucResult;
  if (ucErr || !ucRow) {
    throw new Error(`USER_CHART_NOT_FOUND: ${ucErr?.message ?? 'no chart'}`);
  }

  const { data: rcRow, error: rcErr } = rcResult;
  if (rcErr || !rcRow) {
    throw new Error(`RELATION_CHART_NOT_FOUND: ${rcErr?.message ?? 'no chart'}`);
  }

  const basePayload = buildLlmPayload({
    self: (ucRow as unknown as ChartRow).chart_core,
    relation: (rcRow as unknown as ChartRow).chart_core,
    mode: hapcard.mode,
    theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
  });
  const replayPayload = buildReplayPayload(basePayload, input.jinjin_date);

  const llm = await callOpenAi(
    { systemPrompt: replaySystemPrompt, userPayload: replayPayload },
    { openaiClient: deps.openaiClient, supabaseServiceRole: deps.supabaseServiceClient },
  );

  const content: HapcardResult['content'] = {
    main_text: llm.output.main_text,
    cause_factors: llm.output.cause_factors,
    classic_citation: llm.output.classic_citation.map((c) => {
      const citation = c as Record<string, unknown>;
      // replay는 RAG hit 없음 — convertHanja로 한자 → 한글 변환
      return mapLlmCitation(citation);
    }),
    actions: llm.output.actions,
    why_cards: llm.output.why_cards,
  };

  const { data: row, error } = await deps.supabaseServiceClient
    .from('hapcard_replays')
    .insert({
      hapcard_id: hapcard.hapcard_id,
      user_id: hapcard.user_id,
      jinjin_date: input.jinjin_date,
      replay_reason: input.replay_reason ?? null,
      content,
      prompt_version: prompt.version,
      llm_model: llm.model,
      cache_key: cacheKey,
    })
    .select('replay_id, created_at')
    .single();

  if (error || !row) {
    throw new Error(`HAPCARD_REPLAY_INSERT_FAILED: ${error?.message ?? 'unknown'}`);
  }

  const insertedRow = row as { replay_id: string; created_at: string };
  return {
    ...hapcard,
    replay_id: insertedRow.replay_id,
    jinjin_date: input.jinjin_date,
    content,
    prompt_version: prompt.version,
    llm_model: llm.model as LlmModel,
    cache_key: cacheKey,
    created_at: insertedRow.created_at,
  };
}
