import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import {
  RelationCreateSchema,
  type FeedListItem,
  type RelationErrorCode,
} from '@/types/relation';
import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';
import { computeChart } from '@/lib/chart/compute';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from('relations')
    .select('relation_id, nickname, mode, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  const items = (data ?? []) as FeedListItem[];
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = RelationCreateSchema.safeParse(json);
  if (!parsed.success) return apiErrorResponse('INVALID_BODY', '', 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  // builder.ts 패턴 동일: Zod 검증 완료 후 untyped client로 INSERT
  // relation_id가 INSERT 후 확정되므로 relations 먼저 INSERT
  const db = supabase as unknown as SupabaseClient;
  const { data: insertedRows, error } = await db.from('relations').insert({
    user_id: user.id,
    nickname: parsed.data.nickname,
    mode: parsed.data.mode,
    gender: parsed.data.gender,
    birth_date: parsed.data.birth_date,
    birth_date_calendar: parsed.data.birth_date_calendar,
    is_lunar_leap: parsed.data.is_lunar_leap,
    birth_time_knowledge: parsed.data.birth_time_knowledge,
    birth_time: parsed.data.birth_time,
    birth_longitude: parsed.data.birth_longitude ?? null,
    consent_confirmed: parsed.data.consent_confirmed,
    is_primary: parsed.data.is_primary,
  }).select('relation_id');

  if (error) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  // chart compute — 실패 시 relation은 등록 완료 (chartPending UX), chart는 추후 재시도 가능
  const relationId = (insertedRows as Array<{ relation_id: string }>)?.[0]?.relation_id ?? '';
  if (!relationId) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  try {
    const computeResult = await computeChart(
      {
        entity_id: relationId,
        birth_date: parsed.data.birth_date,
        birth_date_calendar: parsed.data.birth_date_calendar,
        is_lunar_leap: parsed.data.is_lunar_leap,
        birth_time_knowledge: parsed.data.birth_time_knowledge,
        birth_time: parsed.data.birth_time,
        gender: parsed.data.gender,
        theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
      },
      process.env.KASI_SERVICE_KEY!,
    );

    const { error: chartError } = await db.from('relation_charts').upsert(
      {
        relation_id: relationId,
        user_id: user.id,
        chart_hash: computeResult.chart_hash,
        chart_core: computeResult.chart_core,
        theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
      },
      { onConflict: 'chart_hash' },
    );
    if (chartError) {
      console.error('[relations] relation_charts upsert failed', {
        error_code: chartError.code,
        error: sanitizeErrorForLog(new Error(chartError.message)),
      });
    }
  } catch (err) {
    console.error('[relations] computeChart failed', { error: sanitizeErrorForLog(err) });
    // KASI 실패 → relation 등록은 완료, hapcard에서 chartPending으로 표시
  }

  return NextResponse.json({ ok: true, relation_id: relationId });
}
