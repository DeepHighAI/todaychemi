import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import {
  RelationCreateSchema,
  type FeedListItem,
  type RelationErrorCode,
} from '@/types/relation';

function errorResponse(code: RelationErrorCode, status: number) {
  return NextResponse.json({ code }, { status });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse('UNAUTHORIZED', 401);

  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from('relations')
    .select('relation_id, nickname, mode, created_at')
    .order('created_at', { ascending: false });

  if (error) return errorResponse('INTERNAL_ERROR', 500);

  const items = (data ?? []) as FeedListItem[];
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = RelationCreateSchema.safeParse(json);
  if (!parsed.success) return errorResponse('INVALID_BODY', 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse('UNAUTHORIZED', 401);

  // builder.ts 패턴 동일: Zod 검증 완료 후 untyped client로 INSERT
  const db = supabase as unknown as SupabaseClient;
  const { error } = await db.from('relations').insert({
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
  });

  if (error) return errorResponse('INTERNAL_ERROR', 500);
  return NextResponse.json({ ok: true });
}
