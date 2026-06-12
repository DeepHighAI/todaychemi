import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChartCore, ChartHash } from '@/types/chart';
import type { Mode } from '@/types/mode';
import type { HapcardResult } from '@/types/hapcard';
import { withYunseAtDate, type ChartBirthForYunse } from '@/lib/chart/yunse-at-date';
import { computeCrossAnalysisSafe } from '@/lib/saju/cross';
import { computeScore } from '@/lib/scoring/index';
import { loadPromptForUser, MODE_TO_PROMPT_NAME } from '@/lib/llm/prompt-loader';
import { deriveCacheKey } from '@/lib/hapcard/cache-key';
import { buildLlmPayload } from '@/lib/llm/payload';
import { embedQuery } from '@/lib/rag/embeddings';
import { retrieveClassics } from '@/lib/rag/classics';
import { buildRagQueryTags } from '@/lib/rag/query-tags';
import { selectLlmModel } from '@/lib/llm/model-router';
import { callOpenAi, type CallOpenAiDeps } from '@/lib/llm/openai';
import { validateClassicCitations } from '@/lib/rag/grounding-validator';
import { deriveVisuals } from '@/lib/hapcard/visuals';
import { buildOhaengInterpretation } from '@/lib/hapcard/ohaeng-interpretation';
import { SCORING_VERSION } from '@/lib/scoring/constants';
import { mapLlmCitation } from '@/lib/glossary/citation-mapper';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';

export interface BuildHapcardInput {
  user_id: string;
  relation_id: string;
  mode: Mode;
  self: ChartCore;
  self_chart_hash: ChartHash;
  relation: ChartCore;
  relation_chart_hash: ChartHash;
  theory_profile_version: string;
  target_date: string;
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

export interface BuildHapcardResult {
  result: HapcardResult;
  fromCache: boolean;
  cacheKey: string;
}

function assertCacheRowMatchesInput(
  row: HapcardResult,
  input: BuildHapcardInput,
  cacheKey: string,
  promptVersion: string,
): void {
  const mismatches: string[] = [];

  if (row.user_id !== input.user_id) mismatches.push('user_id');
  if (row.relation_id !== input.relation_id) mismatches.push('relation_id');
  if (row.mode !== input.mode) mismatches.push('mode');
  if (row.target_date !== input.target_date) mismatches.push('target_date');
  if (row.prompt_version !== promptVersion) mismatches.push('prompt_version');
  if (row.cache_key !== cacheKey) mismatches.push('cache_key');
  if (row.user_chart_hash !== input.self_chart_hash) mismatches.push('user_chart_hash');
  if (row.relation_chart_hash !== input.relation_chart_hash) mismatches.push('relation_chart_hash');

  if (mismatches.length > 0) {
    throw new Error(`HAPCARD_CACHE_MISMATCH: ${mismatches.join(',')}`);
  }
}

export async function getHapcardCacheKey(
  input: BuildHapcardInput,
  client: SupabaseClient,
): Promise<string> {
  const prompt = await loadPromptForUser(
    client,
    MODE_TO_PROMPT_NAME[input.mode],
    input.user_id,
  );
  const modelId = selectLlmModel('hapcard');

  return deriveCacheKey({
    relation_id: input.relation_id,
    user_chart_hash: input.self_chart_hash,
    relation_chart_hash: input.relation_chart_hash,
    mode: input.mode,
    prompt_version: prompt.version,
    model_id: modelId,
    theory_profile_version: input.theory_profile_version,
    target_date: input.target_date,
  });
}

// relations.nickname 조회 — 실패해도 throw 하지 않는다 (공유 UX 보조 데이터, 핵심 경로 차단 금지)
async function fetchRelationNickname(
  client: SupabaseClient,
  relation_id: string,
): Promise<string | undefined> {
  const { data } = await client
    .from('relations')
    .select('nickname')
    .eq('relation_id', relation_id)
    .maybeSingle();
  return (data as { nickname?: string } | null)?.nickname;
}

interface BirthRow {
  birth_date: string;
  birth_date_calendar: 'solar' | 'lunar';
  is_lunar_leap: boolean;
  birth_time_knowledge: 'exact' | 'approximate' | 'unknown';
  birth_time: string | null;
  gender: 'M' | 'F';
}

function toBirthForYunse(row: BirthRow): ChartBirthForYunse {
  return {
    birth_date: row.birth_date,
    birth_date_calendar: row.birth_date_calendar,
    is_lunar_leap: row.is_lunar_leap,
    birth_time_knowledge: row.birth_time_knowledge,
    birth_time: row.birth_time,
    gender: row.gender,
  };
}

async function fetchUserBirth(
  client: SupabaseClient,
  user_id: string,
): Promise<ChartBirthForYunse> {
  const { data, error } = await client
    .from('users')
    .select('birth_date,birth_date_calendar,is_lunar_leap,birth_time_knowledge,birth_time,gender')
    .eq('user_id', user_id)
    .maybeSingle();
  if (error) throw new Error(`USER_BIRTH_LOOKUP_FAILED: ${error.message}`);
  if (!data) throw new Error('USER_BIRTH_NOT_FOUND');
  return toBirthForYunse(data as BirthRow);
}

async function fetchRelationBirth(
  client: SupabaseClient,
  relation_id: string,
): Promise<ChartBirthForYunse> {
  const { data, error } = await client
    .from('relations')
    .select('birth_date,birth_date_calendar,is_lunar_leap,birth_time_knowledge,birth_time,gender')
    .eq('relation_id', relation_id)
    .maybeSingle();
  if (error) throw new Error(`RELATION_BIRTH_LOOKUP_FAILED: ${error.message}`);
  if (!data) throw new Error('RELATION_BIRTH_NOT_FOUND');
  return toBirthForYunse(data as BirthRow);
}

interface TargetDateCharts {
  self: ChartCore;
  relation: ChartCore;
  // 교차분석 연령차 밴드 산출용 — 서버 내부 전용, LLM 페이로드 미진입
  selfBirth: ChartBirthForYunse;
  relationBirth: ChartBirthForYunse;
}

async function buildTargetDateCharts(
  input: BuildHapcardInput,
  client: SupabaseClient,
): Promise<TargetDateCharts> {
  const [selfBirth, relationBirth] = await Promise.all([
    fetchUserBirth(client, input.user_id),
    fetchRelationBirth(client, input.relation_id),
  ]);
  return {
    self: withYunseAtDate(input.self, selfBirth, input.target_date),
    relation: withYunseAtDate(input.relation, relationBirth, input.target_date),
    selfBirth,
    relationBirth,
  };
}

// 출생연도 추출 — band 산출 전용 (음력 연초 ±1 오차는 문서화된 단순화, 설계 §1.3).
// 형식 검증 필수: Number(''.slice(0,4)) === 0 이라 빈 문자열이 '연도 0'으로 통과해
// 거짓 age_gap('7+ 연상')이 LLM 에 fact 로 전달된다 (리뷰 F4). 실패 시 undefined → age_gap 생략.
// (현 경로에서는 withYunseAtDate 의 ssaju 검증이 먼저 throw 하지만, 호출 순서 변경에 대한 방어층)
export function birthYearOf(birth: ChartBirthForYunse): number | undefined {
  const match = /^(\d{4})-/.exec(birth.birth_date ?? '');
  if (match === null) return undefined;
  const year = Number(match[1]);
  // 타당 범위 밖(예: 0000, 9999 더미)은 밴드 신뢰 불가 — 생략
  return year >= 1900 && year <= 2100 ? year : undefined;
}

export async function buildHapcardWithMeta(
  input: BuildHapcardInput,
  deps: BuildHapcardDeps,
): Promise<BuildHapcardResult> {
  // 1. ADR-008 canary 5% 분산 라우팅 — userId deterministic sampling.
  //    canary 부재 또는 ratio=0 시 active 로 안전하게 fallback.
  const prompt = await loadPromptForUser(
    deps.supabaseUserClient,
    MODE_TO_PROMPT_NAME[input.mode],
    input.user_id,
  );
  const llmModel = selectLlmModel('hapcard');

  // 2. cache key 파생 — target_date 포함: 같은 인연/모드도 KST 날짜별 별도 결과
  const cacheKey = deriveCacheKey({
    relation_id: input.relation_id,
    user_chart_hash: input.self_chart_hash,
    relation_chart_hash: input.relation_chart_hash,
    mode: input.mode,
    prompt_version: prompt.version,
    model_id: llmModel,
    theory_profile_version: input.theory_profile_version,
    target_date: input.target_date,
  });

  // 3. cache lookup — hit 이면 즉시 반환
  const cacheRes = await deps.supabaseUserClient
    .from('hapcards')
    .select('*')
    .eq('cache_key', cacheKey)
    .maybeSingle();
  if (cacheRes.error) {
    throw new Error(`HAPCARD_CACHE_LOOKUP_FAILED: ${cacheRes.error.message}`);
  }
  if (cacheRes.data) {
    const cacheRow = cacheRes.data as HapcardResult;
    assertCacheRowMatchesInput(cacheRow, input, cacheKey, prompt.version);
    const relation_nickname = await fetchRelationNickname(
      deps.supabaseUserClient,
      input.relation_id,
    );
    return {
      result: {
      ...cacheRow,
      visuals: deriveVisuals(input.self, input.relation),
      relation_nickname,
      relation_gender_normalized: input.relation.gender_normalized,
      },
      fromCache: true,
      cacheKey,
    };
  }

  // 4. target_date 기준 운세층 재계산 — birth row는 서버 내부에서만 사용, LLM에는 원본 생년월일 전송 금지
  const datedCharts = await buildTargetDateCharts(input, deps.supabaseUserClient);

  // 5. 결정형 점수 — ADR-035, LLM 점수 개입 금지
  const scoreOutput = computeScore({
    self: datedCharts.self,
    relation: datedCharts.relation,
    mode: input.mode,
  });

  // 5.5 교차분석 — 점수와 동일한 dated 차트 기준, LLM 해석 근거 전용 facts.
  //     ADR-035: computeScore 입력·출력에 무접촉. 출생연도는 band 산출에만 사용 —
  //     원본 연도는 payload 미진입 (age_gap band/relation_is 문자열만).
  const crossAnalysis = computeCrossAnalysisSafe({
    self: datedCharts.self,
    relation: datedCharts.relation,
    mode: input.mode,
    self_birth_year: birthYearOf(datedCharts.selfBirth),
    relation_birth_year: birthYearOf(datedCharts.relationBirth),
  });

  // 6. LLM payload 빌드 (PII 5필드 제외 — AGENTS.md §5)
  const payload = buildLlmPayload({
    self: datedCharts.self,
    relation: datedCharts.relation,
    mode: input.mode,
    theory_profile_version: input.theory_profile_version,
    target_date: input.target_date,
    question_slot: input.question_slot,
    cross_analysis: crossAnalysis,
  });

  // 7. RAG retrieval
  const datedInput: BuildHapcardInput = {
    ...input,
    self: datedCharts.self,
    relation: datedCharts.relation,
  };
  const queryText = deps.ragQueryText(datedInput);
  const queryVec = await embedQuery(queryText, { embeddings: deps.embeddingsClient });
  // ISSUE-001 (§1.1 결정 ③): topic_tags lexical 하이브리드 — 단문 쿼리 임계 미달 우회
  const queryTags = buildRagQueryTags(
    { mode: input.mode, self: datedCharts.self },
    crossAnalysis,
  );
  const ragHits = await retrieveClassics(deps.supabaseServiceClient, queryVec, { queryTags });

  // 8. system prompt 조합 (RAG hits scaffolding — 0-hit 시 LLM hallucination 차단)
  const ragSection =
    ragHits.length === 0
      ? `## RAG hits\n\nNo classical references match this query.\nSet \`classic_citation: []\` in your response.\nDO NOT invent asset_ids — empty array is the correct output here.`
      : `## Available RAG hits — use ONLY these asset_ids verbatim\n\nAny asset_id NOT in this list will fail validation and the request will be rejected.\n\n<rag_hits>\n${JSON.stringify(ragHits, null, 2)}\n</rag_hits>`;
  const systemPrompt = `${prompt.content}\n\n${ragSection}`;

  // 9. LLM 호출 + grounding 검증 (최대 1회 재시도)
  const callDeps = {
    openaiClient: deps.openaiClient,
    supabaseServiceRole: deps.supabaseServiceClient,
  };
  const callInput = { systemPrompt, userPayload: payload, model: llmModel };
  let llmResult = await callOpenAi(callInput, callDeps);
  let grounding = validateClassicCitations(
    { classic_citation: llmResult.output.classic_citation },
    ragHits,
  );
  if (!grounding.valid) {
    llmResult = await callOpenAi(callInput, callDeps);
    grounding = validateClassicCitations(
      { classic_citation: llmResult.output.classic_citation },
      ragHits,
    );
    if (!grounding.valid) {
      throw new Error(`GROUNDING_FAILED: ${JSON.stringify(grounding.errors)}`);
    }
  }

  // 10. LLM classic_citation 형식 → HapcardResult.content.classic_citation 형식 변환
  const content: HapcardResult['content'] = {
    main_text: llmResult.output.main_text,
    cause_factors: llmResult.output.cause_factors,
    classic_citation: llmResult.output.classic_citation.map((c) => {
      const citation = c as Record<string, unknown>;
      // asset_id 기준으로 RAG hit 조회 — original_reading이 있으면 우선 사용
      const ragHit = ragHits.find((h) => h.asset_id === citation.asset_id);
      return mapLlmCitation(citation, ragHit);
    }),
    actions: llmResult.output.actions,
    why_cards: llmResult.output.why_cards,
    ohaeng_interpretation: llmResult.output.ohaeng_interpretation ?? buildOhaengInterpretation({
      self: datedCharts.self,
      relation: datedCharts.relation,
      mode: input.mode,
    }),
  };

  // 11. INSERT → HapcardResult 반환
  const insertRes = await deps.supabaseUserClient
    .from('hapcards')
    .insert({
      user_id: input.user_id,
      relation_id: input.relation_id,
      mode: input.mode,
      target_date: input.target_date,
      compat_score: scoreOutput.score,
      score_breakdown: {
        hap_chung_hyung_hae: scoreOutput.components.hap_chung_hyung_hae,
        sipsin: scoreOutput.components.sipsin,
        ohaeng: scoreOutput.components.ohaeng,
        yunse_adjustment: scoreOutput.yunse_adjustment,
        mode_adjustment: scoreOutput.mode_adjustment,
        // G-4: 시간 미상 시나리오 ± 범위 — 표시 전용 (점수 본체 무접촉, ADR-035)
        scenario_estimate: scoreOutput.scenario_estimate,
      },
      content,
      prompt_version: prompt.version,
      llm_model: llmResult.model,
      cache_key: cacheKey,
      user_chart_hash: input.self_chart_hash,
      relation_chart_hash: input.relation_chart_hash,
      archived_at: null,
      version_label: null,
    })
    .select()
    .single();

  if (insertRes.error) {
    const retry = await deps.supabaseUserClient
      .from('hapcards')
      .select('*')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (retry.data) {
      const retryRow = retry.data as HapcardResult;
      assertCacheRowMatchesInput(retryRow, input, cacheKey, prompt.version);
      const relation_nickname = await fetchRelationNickname(
        deps.supabaseUserClient,
        input.relation_id,
      );
      return {
        result: {
          ...retryRow,
          visuals: deriveVisuals(datedCharts.self, datedCharts.relation),
          relation_nickname,
          relation_gender_normalized: datedCharts.relation.gender_normalized,
        },
        fromCache: true,
        cacheKey,
      };
    }
    throw new Error(`HAPCARD_INSERT_FAILED: ${insertRes.error.message}`);
  }

  // 12. snapshot upsert — ADR-036 change_score 기준점
  const snapRes = await deps.supabaseServiceClient
    .from('hapcard_score_snapshots')
    .upsert({
      user_id: input.user_id,
      relation_id: input.relation_id,
      mode: input.mode,
      scoring_version: String(SCORING_VERSION),
      prompt_version: prompt.version,
      target_date: input.target_date,
      compat_score: scoreOutput.score,
      score_breakdown: {
        hap_chung_hyung_hae: scoreOutput.components.hap_chung_hyung_hae,
        sipsin: scoreOutput.components.sipsin,
        ohaeng: scoreOutput.components.ohaeng,
        yunse_adjustment: scoreOutput.yunse_adjustment,
        mode_adjustment: scoreOutput.mode_adjustment,
      },
    });
  if (snapRes.error) {
    console.error('[hapcard] snapshot upsert failed', {
      error: sanitizeErrorForLog(snapRes.error.message),
    });
  }

  const relation_nickname = await fetchRelationNickname(
    deps.supabaseUserClient,
    input.relation_id,
  );
  return {
    result: {
    ...(insertRes.data as HapcardResult),
    visuals: deriveVisuals(datedCharts.self, datedCharts.relation),
    relation_nickname,
    relation_gender_normalized: datedCharts.relation.gender_normalized,
    },
    fromCache: false,
    cacheKey,
  };
}

export async function buildHapcard(
  input: BuildHapcardInput,
  deps: BuildHapcardDeps,
): Promise<HapcardResult> {
  const { result } = await buildHapcardWithMeta(input, deps);
  return result;
}
