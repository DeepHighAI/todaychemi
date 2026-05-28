import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { fetchLatestUserChart } from '@/lib/chart/queries';

import { createClient } from '@/lib/supabase/server';
import { createOpenAiClient } from '@/lib/llm/clients';
import { buildDailyHap } from '@/lib/today/builder';
import { callDailyHapLlm } from '@/lib/today/openai';
import { todayKST, yesterdayKST } from '@/lib/today/kst-date';
import { buildSourcePacketHash } from '@/lib/today/cache-key';
import type { DailyHapCard } from '@/types/dailyHap';
import type { ChartCore } from '@/types/chart';

interface DailyHapRow {
  headline: string;
  headline_reason: string;
  avoid_phrase: string;
  avoid_phrase_reason: string;
  favorable_action: string;
  favorable_action_reason: string;
  reused_from_yesterday: boolean;
}

function rowToCard(row: DailyHapRow): DailyHapCard {
  return {
    headline: row.headline,
    headline_reason: row.headline_reason,
    avoid_phrase: row.avoid_phrase,
    avoid_phrase_reason: row.avoid_phrase_reason,
    favorable_action: row.favorable_action,
    favorable_action_reason: row.favorable_action_reason,
    reused_from_yesterday: row.reused_from_yesterday,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }

    const target = todayKST();
    const prev = yesterdayKST();
    const openai = createOpenAiClient();

    // saveCard 클로저가 재사용할 수 있도록 fetchUserChart 결과를 외부 스코프에 캡처
    let cachedChart: ChartCore | null = null;

    const card = await buildDailyHap({
      fetchTodayCache: async () => {
        const { data } = await supabase
          .from('daily_haps')
          .select('headline,headline_reason,avoid_phrase,avoid_phrase_reason,favorable_action,favorable_action_reason,reused_from_yesterday')
          .eq('user_id', user.id)
          .eq('target_date', target)
          .maybeSingle();
        return data ? rowToCard(data as DailyHapRow) : null;
      },

      fetchYesterdayCache: async () => {
        const { data } = await supabase
          .from('daily_haps')
          .select('headline,headline_reason,avoid_phrase,avoid_phrase_reason,favorable_action,favorable_action_reason,reused_from_yesterday')
          .eq('user_id', user.id)
          .eq('target_date', prev)
          .maybeSingle();
        return data ? rowToCard(data as DailyHapRow) : null;
      },

      fetchUserChart: async () => {
        const { data } = await fetchLatestUserChart(supabase, user.id);
        cachedChart = data ? (data.chart_core as unknown as ChartCore) : null;
        return cachedChart;
      },

      callLlm: (chart) => callDailyHapLlm(chart, openai),

      saveCard: async (c) => {
        // fetchUserChart 결과를 외부 스코프에서 캡처 — 중복 DB 쿼리 제거
        // G2 / Phase 3 C3: 캐시 키 차원 확장 (relation_chart/prompt_version/model_id 추가).
        // 현 단계는 사용자 단독 today 만 — relation_chart=null, prompt_version/model_id 고정.
        // C7 에서 3축 분기 + 동적 값 주입 예정.
        const hash = buildSourcePacketHash({
          self_chart: cachedChart ?? ({} as ChartCore),
          relation_chart: null,
          target_date: target,
          prompt_version: 'v0.3',
          model_id: 'gpt-5-mini',
        });
        await supabase.from('daily_haps').upsert(
          {
            user_id: user.id,
            target_date: target,
            headline: c.headline,
            headline_reason: c.headline_reason,
            avoid_phrase: c.avoid_phrase,
            avoid_phrase_reason: c.avoid_phrase_reason,
            favorable_action: c.favorable_action,
            favorable_action_reason: c.favorable_action_reason,
            source_packet_hash: hash,
            reused_from_yesterday: c.reused_from_yesterday,
          },
          { onConflict: 'user_id,target_date' },
        );
      },
    });

    return NextResponse.json({ ok: true, card });
  } catch (err) {
    console.error('[/api/today]', err);
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}
