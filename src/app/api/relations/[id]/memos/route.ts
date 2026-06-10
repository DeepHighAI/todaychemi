import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { MemoCreateSchema } from '@/types/memo';
import type { MemoItem, MemoListResponse, MemoCreateResponse } from '@/types/memo';

const MEMO_SELECT = 'memo_id, relation_id, body, created_at, updated_at';

// GET /api/relations/[id]/memos — 인연의 메모 목록 (created_at asc, 시간순)
// island.md:183: 메모는 점수에 0 영향. LLM 페이로드에 절대 포함 금지 (AGENTS.md §5).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const db = supabase;

  const { data, error } = await db
    .from('relation_memos')
    .select(MEMO_SELECT)
    .eq('relation_id', id)
    .order('created_at', { ascending: true });

  if (error) return apiErrorResponse('INTERNAL_ERROR', error.message, 500);

  return NextResponse.json(
    { items: (data ?? []) as MemoItem[] } satisfies MemoListResponse,
    { status: 200 },
  );
}

// POST /api/relations/[id]/memos — 메모 생성
// LOCKED: relation_memos 테이블만 변경. hapcard_score_snapshots 미기록 (island.md:183).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = MemoCreateSchema.safeParse(json);
  if (!parsed.success) return apiErrorResponse('INVALID_BODY', '', 400);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const db = supabase;

  // 인연 소유권 pre-check (RLS가 타 소유자를 차단해 null 반환)
  const relRes = await db
    .from('relations')
    .select('relation_id')
    .eq('relation_id', id)
    .maybeSingle();
  if (relRes.error) return apiErrorResponse('INTERNAL_ERROR', relRes.error.message, 500);
  if (!relRes.data) return apiErrorResponse('RELATION_NOT_FOUND', '', 404);

  const { data: memo, error } = await db
    .from('relation_memos')
    .insert({ user_id: user.id, relation_id: id, body: parsed.data.body })
    .select(MEMO_SELECT)
    .single();

  if (error || !memo) return apiErrorResponse('INTERNAL_ERROR', error?.message ?? '', 500);

  return NextResponse.json(
    { ok: true, memo: memo as MemoItem } satisfies MemoCreateResponse,
    { status: 200 },
  );
}
