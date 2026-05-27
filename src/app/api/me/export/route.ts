import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { createClient } from '@/lib/supabase/server';

const EXPORT_TABLES = [
  {
    key: 'profile',
    table: 'users',
    select:
      'user_id,nickname,birth_date,birth_date_calendar,is_lunar_leap,birth_time_knowledge,birth_time,gender,consented_at,consented_tos_version,consented_privacy_version,age_confirmed,deletion_requested_at,created_at,updated_at',
    single: true,
  },
  {
    key: 'user_charts',
    table: 'user_charts',
    select: 'chart_hash,chart_core,theory_profile_version,created_at',
    single: false,
  },
  {
    key: 'relations',
    table: 'relations',
    select:
      'relation_id,nickname,mode,gender,birth_date,birth_date_calendar,is_lunar_leap,birth_time_knowledge,birth_time,consent_confirmed,created_at,updated_at',
    single: false,
  },
  {
    key: 'relation_charts',
    table: 'relation_charts',
    select: 'relation_id,chart_hash,chart_core,theory_profile_version,created_at',
    single: false,
  },
  {
    key: 'hapcards',
    table: 'hapcards',
    select:
      'hapcard_id,relation_id,mode,target_date,compat_score,score_breakdown,content,prompt_version,llm_model,created_at',
    single: false,
  },
  {
    key: 'token_ledger',
    table: 'token_ledger',
    select: 'ledger_id,delta,balance_after,reason,reference_id,created_at',
    single: false,
  },
  {
    key: 'payments',
    table: 'payments',
    select:
      'payment_id,toss_order_id,product_id,amount_krw,token_amount,status,confirmed_at,created_at,receipt_url',
    single: false,
  },
] as const;

type ExportQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      order: (
        column: string,
        options: { ascending: boolean },
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const exportedAt = new Date().toISOString();
  const payload: Record<string, unknown> = {
    exported_at: exportedAt,
    user: {
      id: user.id,
      email: user.email ?? null,
    },
  };
  const db = supabase as unknown as SupabaseClient;
  const fromTable = db.from as unknown as (table: string) => ExportQuery;

  for (const config of EXPORT_TABLES) {
    const query = fromTable(config.table).select(config.select).eq('user_id', user.id);
    const { data, error } = config.single
      ? await query.maybeSingle()
      : await query.order('created_at', { ascending: false });

    if (error) {
      return apiErrorResponse('INTERNAL_ERROR', error.message, 500);
    }
    if (config.single && !data) {
      return apiErrorResponse('NOT_ONBOARDED', '', 404);
    }
    payload[config.key] = data ?? (config.single ? null : []);
  }

  const body = JSON.stringify(payload, null, 2);
  const filename = `today-sai-data-${exportedAt.slice(0, 10)}.json`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
