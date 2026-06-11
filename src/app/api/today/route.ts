import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { ensureUserChartRow } from '@/lib/chart/ensure-user-chart';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { selectLlmModel } from '@/lib/llm/model-router';
import { createOpenAiClient } from '@/lib/llm/clients';
import {
  buildDailyHap,
  type TodayRelationMeta,
  type TodayTrace,
} from '@/lib/today/builder';
import { callDailyHapLlm } from '@/lib/today/openai';
import { pickTodayRelation } from '@/lib/today/relation-picker';
import { ensureRelationChart } from '@/lib/today/lazy-relation-chart';
import { withYunseAtDate, type ChartBirthForYunse } from '@/lib/chart/yunse-at-date';
import { computeTodayCompatScore } from '@/lib/scoring/today';
import { todayKST, yesterdayKST } from '@/lib/today/kst-date';
import { buildSourcePacketHash } from '@/lib/today/cache-key';
import { redactSensitiveLogText, sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import type { DailyHapCard } from '@/types/dailyHap';
import { DEFAULT_THEORY_PROFILE_VERSION, type ChartCore } from '@/types/chart';

// Task 1: builder trace 의 failedPhase + errorMessage 에서 error_events.error_code 추출.
// openai.ts 가 LLM_TIMEOUT: / LLM_PARSE_FAIL: prefix 로 throw 하므로 그 패턴을 1순위로 매칭.
function classifyTraceFailure(
  failedPhase: string,
  errorMessage: string | undefined,
): string {
  const msg = errorMessage ?? '';
  if (msg.startsWith('LLM_TIMEOUT:') || /timeout|aborted|timed out/i.test(msg)) {
    return 'LLM_TIMEOUT';
  }
  if (msg.startsWith('LLM_PARSE_FAIL:') || /Unexpected token|JSON/i.test(msg)) {
    return 'LLM_PARSE_FAIL';
  }
  if (failedPhase === 'userChart' && msg === 'chart_null') {
    return 'USER_CHART_NOT_FOUND';
  }
  return 'TODAY_BUILD_FAIL';
}

// F1.3: 영속화 시 신규 3컬럼(primary_relation_id, relation_nickname, today_compat_score)
// 모두 포함. 캐시 hit 이 신규 컬럼을 직접 반환하므로 applyRelationMetaToResponse 의
// 재계산은 cache-miss + legacy row(null 신규 컬럼) 폴백 전용.
export interface DailyHapRow {
  headline: string;
  headline_reason: string;
  avoid_phrase: string;
  avoid_phrase_reason: string;
  favorable_action: string;
  favorable_action_reason: string;
  reused_from_yesterday: boolean;
  source_packet_hash?: string | null;
  llm_model?: string | null;
  primary_relation_id?: string | null;
  relation_nickname?: string | null;
  today_compat_score?: number | null;
}

export function rowToCard(row: DailyHapRow): DailyHapCard {
  return {
    headline: row.headline,
    headline_reason: row.headline_reason,
    avoid_phrase: row.avoid_phrase,
    avoid_phrase_reason: row.avoid_phrase_reason,
    favorable_action: row.favorable_action,
    favorable_action_reason: row.favorable_action_reason,
    reused_from_yesterday: row.reused_from_yesterday,
    relation_id: row.primary_relation_id ?? null,
    relation_nickname: row.relation_nickname ?? null,
    today_compat_score: row.today_compat_score ?? null,
  };
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

async function fetchUserBirthForYunse(
  client: SupabaseClient,
  userId: string,
): Promise<ChartBirthForYunse> {
  const { data, error } = await client
    .from('users')
    .select('birth_date,birth_date_calendar,is_lunar_leap,birth_time_knowledge,birth_time,gender')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`USER_BIRTH_LOOKUP_FAILED: ${error.message}`);
  if (!data) throw new Error('USER_BIRTH_NOT_FOUND');
  return toBirthForYunse(data as BirthRow);
}

async function fetchRelationBirthForYunse(
  client: SupabaseClient,
  relationId: string,
): Promise<ChartBirthForYunse> {
  const { data, error } = await client
    .from('relations')
    .select('birth_date,birth_date_calendar,is_lunar_leap,birth_time_knowledge,birth_time,gender')
    .eq('relation_id', relationId)
    .maybeSingle();
  if (error) throw new Error(`RELATION_BIRTH_LOOKUP_FAILED: ${error.message}`);
  if (!data) throw new Error('RELATION_BIRTH_NOT_FOUND');
  return toBirthForYunse(data as BirthRow);
}

// G2 / Phase 3 C7 — 프롬프트 버전 식별자 (캐시 키 차원).
const PROMPT_VERSION_SINGLE = 'daily_hap:v0.3';
const PROMPT_VERSION_RELATION = 'today_with_relation:v0.1';

// G2 / Phase 3 C9 — feature flag (false 시 기존 단독축 today 유지).
function todayWithRelationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TODAY_WITH_RELATION !== 'false';
}

// 캐시 hit / miss 양쪽에서 동일하게 relation 메타 재계산 후 카드에 주입.
// (DB 에 영속화하지 않으므로 응답마다 현재 인연 기준 최신 값으로 갱신됨)
function applyRelationMetaToResponse(
  card: DailyHapCard,
  relation: TodayRelationMeta | null,
  selfChart: ChartCore | null,
  relationChart: ChartCore | null,
  todayDate: string,
): DailyHapCard {
  if (!relation || !selfChart) return card;
  const todayCompatScore = relationChart
    ? computeTodayCompatScore(selfChart, relationChart, todayDate)
    : null;
  return {
    ...card,
    relation_id: relation.id,
    relation_nickname: relation.nickname,
    today_compat_score: card.is_fallback ? null : todayCompatScore,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }
    const userId = user.id;

    const target = todayKST();
    const prev = yesterdayKST();
    const url = new URL(request.url);
    const preferredRelationId = url.searchParams.get('relation_id') ?? undefined;
    const featureEnabled = todayWithRelationEnabled();

    // 인연 자동 선택 (preferred → 최근 등록 → null). feature flag off 시 강제 null.
    const relation: TodayRelationMeta | null = featureEnabled
      ? await pickTodayRelation(supabase, userId, preferredRelationId)
      : null;

    // saveCard / cache-key 가 재사용할 수 있도록 target_date 별 chart 결과를 캡처.
    let cachedBaseSelfChart: ChartCore | null = null;
    let cachedBaseSelfChartResolved = false;
    let cachedSelfBirth: ChartBirthForYunse | null = null;
    let cachedSelfBirthResolved = false;
    const datedSelfCharts = new Map<string, ChartCore | null>();
    const baseRelationCharts = new Map<string, ChartCore | null>();
    const relationBirths = new Map<string, ChartBirthForYunse>();
    const datedRelationCharts = new Map<string, ChartCore | null>();

    // F1.3: 캐시 select 컬럼셋에 신규 3컬럼 포함. 동일 target_date 에 다른 인연으로
    // 생성된 row 가 있을 때 cache miss → 새 LLM 호출 보장 위해 primary_relation_id 일치 필터.
    // (UNIQUE (user_id, target_date) 제약 — 인연 교체 시 row 1개가 overwrite 됨)
    const cacheColumns = 'headline,headline_reason,avoid_phrase,avoid_phrase_reason,favorable_action,favorable_action_reason,reused_from_yesterday,source_packet_hash,llm_model,primary_relation_id,relation_nickname,today_compat_score';
    const currentRelationId = relation?.id ?? null;

    async function resolveBaseSelfChart(): Promise<ChartCore | null> {
      if (cachedBaseSelfChartResolved) return cachedBaseSelfChart;
      // v2 범프 후 기존 유저 lazy 재계산 (ADR-021) — 실패해도 종전처럼 null 로 degrade.
      try {
        const ensured = await ensureUserChartRow(
          supabase,
          userId,
          process.env.KASI_SERVICE_KEY ?? '',
          DEFAULT_THEORY_PROFILE_VERSION,
        );
        cachedBaseSelfChart = ensured?.chart_core ?? null;
      } catch (err) {
        console.error('[today] ensureUserChartRow failed', { error: sanitizeErrorForLog(err) });
        cachedBaseSelfChart = null;
      }
      cachedBaseSelfChartResolved = true;
      return cachedBaseSelfChart;
    }

    async function resolveSelfBirth(): Promise<ChartBirthForYunse> {
      if (cachedSelfBirthResolved && cachedSelfBirth) return cachedSelfBirth;
      cachedSelfBirth = await fetchUserBirthForYunse(supabase, userId);
      cachedSelfBirthResolved = true;
      return cachedSelfBirth;
    }

    async function resolveSelfChart(date: string = target): Promise<ChartCore | null> {
      if (datedSelfCharts.has(date)) return datedSelfCharts.get(date) ?? null;
      const baseChart = await resolveBaseSelfChart();
      if (!baseChart) {
        datedSelfCharts.set(date, null);
        return null;
      }
      const birth = await resolveSelfBirth();
      const datedChart = withYunseAtDate(baseChart, birth, date);
      datedSelfCharts.set(date, datedChart);
      return datedChart;
    }

    async function resolveBaseRelationChart(relationId: string): Promise<ChartCore | null> {
      if (baseRelationCharts.has(relationId)) return baseRelationCharts.get(relationId) ?? null;
      const chart = await ensureRelationChart(
        supabase,
        relationId,
        userId,
        process.env.KASI_SERVICE_KEY ?? '',
      );
      baseRelationCharts.set(relationId, chart);
      return chart;
    }

    async function resolveRelationBirth(relationId: string): Promise<ChartBirthForYunse> {
      const cached = relationBirths.get(relationId);
      if (cached) return cached;
      const birth = await fetchRelationBirthForYunse(
        supabase,
        relationId,
      );
      relationBirths.set(relationId, birth);
      return birth;
    }

    async function resolveRelationChart(
      relationId: string,
      date: string = target,
    ): Promise<ChartCore | null> {
      const key = `${relationId}:${date}`;
      if (datedRelationCharts.has(key)) return datedRelationCharts.get(key) ?? null;
      const baseChart = await resolveBaseRelationChart(relationId);
      if (!baseChart) {
        datedRelationCharts.set(key, null);
        return null;
      }
      const birth = await resolveRelationBirth(relationId);
      const datedChart = withYunseAtDate(baseChart, birth, date);
      datedRelationCharts.set(key, datedChart);
      return datedChart;
    }

    async function cacheRowMatchesCurrentSource(row: DailyHapRow, date: string): Promise<boolean> {
      const rowRelationId = row.primary_relation_id ?? null;
      if (rowRelationId !== currentRelationId) return false;

      const modelId = selectLlmModel('today');
      if (!row.source_packet_hash || row.llm_model !== modelId) return false;

      const selfChart = await resolveSelfChart(date);
      if (!selfChart) return false;

      const relationChart = currentRelationId
        ? await resolveRelationChart(currentRelationId, date)
        : null;
      const promptVersion = relationChart ? PROMPT_VERSION_RELATION : PROMPT_VERSION_SINGLE;
      const expectedHash = buildSourcePacketHash({
        self_chart: selfChart,
        relation_chart: relationChart,
        target_date: date,
        prompt_version: promptVersion,
        model_id: modelId,
      });

      return row.source_packet_hash === expectedHash;
    }

    const card = await buildDailyHap({
      fetchTodayCache: async () => {
        const { data, error } = await supabase
          .from('daily_haps')
          .select(cacheColumns)
          .eq('user_id', userId)
          .eq('target_date', target)
          .maybeSingle();
        if (error) throw new Error(`TODAY_CACHE_LOOKUP_FAILED: ${error.message}`);
        if (!data) return null;
        const row = data as DailyHapRow;
        if (!(await cacheRowMatchesCurrentSource(row, target))) return null;
        return rowToCard(row);
      },

      fetchYesterdayCache: async () => {
        const { data, error } = await supabase
          .from('daily_haps')
          .select(cacheColumns)
          .eq('user_id', userId)
          .eq('target_date', prev)
          .maybeSingle();
        if (error) throw new Error(`YESTERDAY_CACHE_LOOKUP_FAILED: ${error.message}`);
        if (!data) return null;
        const row = data as DailyHapRow;
        if (!(await cacheRowMatchesCurrentSource(row, prev))) return null;
        return rowToCard(row);
      },

      fetchUserChart: async () => {
        return resolveSelfChart(target);
      },

      // G2 / Phase 3 C7: relation-picker 결과 그대로 전달.
      fetchRelation: async () => relation,
      // F3.2: chart 미존재 시 lazy KASI compute 통합 (graceful null on failure).
      fetchRelationChart: async (relationId) => {
        return resolveRelationChart(relationId, target);
      },

      callLlm: (input) => {
        const openai = createOpenAiClient();
        const llmCostClient = createServiceRoleClient();
        return callDailyHapLlm(input, openai, supabase, userId, {
          costClient: llmCostClient,
        });
      },

      // Task 1: 단계별 latency + 실패 phase 캡처. 실패 시 error_events 적재 (best-effort).
      recordTrace: async (trace: TodayTrace) => {
        if (!trace.failedPhase) return;
        const code = classifyTraceFailure(trace.failedPhase, trace.errorMessage);
        try {
          const untypedDb = supabase;
          await untypedDb.from('error_events').insert({
            error_code: code,
            user_id: userId,
            context: {
              phase: trace.failedPhase,
              total_ms: Math.round(trace.totalMs),
              phases: trace.phases.map((p) => ({ name: p.name, ms: Math.round(p.durationMs) })),
              source: 'today.recordTrace',
            },
            stack: trace.errorMessage ? redactSensitiveLogText(trace.errorMessage) : null,
          });
        } catch (loggingErr) {
          console.error('[/api/today] error_events insert failed', {
            error: sanitizeErrorForLog(loggingErr),
          });
        }
      },

      saveCard: async (c) => {
        // C3 캐시 키 차원: relation_chart + prompt_version + model_id 동적 주입.
        const selfChart = await resolveSelfChart(target);
        const relationChart = currentRelationId
          ? await resolveRelationChart(currentRelationId, target)
          : null;
        const relationPresent = relationChart !== null;
        const promptVersion = relationPresent ? PROMPT_VERSION_RELATION : PROMPT_VERSION_SINGLE;
        const modelId = selectLlmModel('today');

        const hash = buildSourcePacketHash({
          self_chart: selfChart ?? ({} as ChartCore),
          relation_chart: relationChart,
          target_date: target,
          prompt_version: promptVersion,
          model_id: modelId,
        });

        // F1.2: 신규 3컬럼(primary_relation_id, relation_nickname, today_compat_score)
        // 영속화. card 의 applyRelationMeta 적용 후 값 사용.
        const { error } = await supabase.from('daily_haps').upsert(
          {
            user_id: userId,
            target_date: target,
            headline: c.headline,
            headline_reason: c.headline_reason,
            avoid_phrase: c.avoid_phrase,
            avoid_phrase_reason: c.avoid_phrase_reason,
            favorable_action: c.favorable_action,
            favorable_action_reason: c.favorable_action_reason,
            source_packet_hash: hash,
            reused_from_yesterday: c.reused_from_yesterday,
            primary_relation_id: c.relation_id ?? null,
            relation_nickname: c.relation_nickname ?? null,
            today_compat_score: c.today_compat_score ?? null,
            llm_model: modelId,
          },
          { onConflict: 'user_id,target_date' },
        );
        if (error) {
          throw new Error(`TODAY_CACHE_SAVE_FAILED: ${error.message}`);
        }
      },

      today_date: target,
    });

    // C7: 캐시 hit/miss 양쪽 모두 응답 직전에 현재 인연 메타 재주입.
    // 캐시 행에는 relation 필드가 없지만 응답에는 항상 최신 relation 기준값 표시.
    // cache hit 시 cachedSelfChart/cachedRelationChart 가 비어 있을 수 있어 한 번 더 fetch.
    const finalSelfChart = relation ? await resolveSelfChart(target) : null;
    // F3.2: post-process 경로도 lazy compute 적용 — cache hit 시에도 chart 자동 생성.
    const finalRelationChart = relation ? await resolveRelationChart(relation.id, target) : null;

    const finalCard = card
      ? applyRelationMetaToResponse(
          card,
          relation,
          finalSelfChart,
          finalRelationChart,
          target,
        )
      : null;

    return NextResponse.json({ ok: true, card: finalCard });
  } catch (err) {
    console.error('[/api/today]', { error: sanitizeErrorForLog(err) });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}
