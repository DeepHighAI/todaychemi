import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import {
  RelationCreateSchema,
  type FeedListItem,
  type RelationErrorCode,
} from '@/types/relation';
import { insertRelationAndComputeChart } from '@/lib/relations/insert';

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
  // (INSERT throw / 차트 best-effort 는 헬퍼 책임 — 무료 경로와 슬롯 머티리얼라이즈 공유)
  const db = supabase as unknown as SupabaseClient;
  let relationId: string;
  try {
    relationId = await insertRelationAndComputeChart(db, user.id, parsed.data);
  } catch {
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }

  return NextResponse.json({ ok: true, relation_id: relationId });
}
