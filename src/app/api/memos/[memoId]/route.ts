import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { MemoUpdateSchema } from '@/types/memo';
import type { MemoItem, MemoUpdateResponse } from '@/types/memo';

const MEMO_SELECT = 'memo_id, relation_id, body, created_at, updated_at';

// PATCH /api/memos/[memoId] — 메모 수정
// LOCKED (island.md:183): relation_memos 테이블만 변경.
// hapcard_score_snapshots 또는 기타 점수 테이블 절대 미기록 — compat_score 0 영향 보장.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memoId: string }> },
): Promise<NextResponse> {
  const { memoId } = await params;

  const json = await request.json().catch(() => null);
  const parsed = MemoUpdateSchema.safeParse(json);
  if (!parsed.success) return apiErrorResponse('INVALID_BODY', '', 400);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const db = supabase;

  const { data: memo, error } = await db
    .from('relation_memos')
    .update({ body: parsed.data.body, updated_at: new Date().toISOString() })
    .eq('memo_id', memoId)
    .select(MEMO_SELECT)
    .single();

  if (error) return apiErrorResponse('INTERNAL_ERROR', error.message, 500);
  if (!memo) return apiErrorResponse('MEMO_NOT_FOUND', '', 404);

  return NextResponse.json(
    { ok: true, memo: memo as MemoItem } satisfies MemoUpdateResponse,
    { status: 200 },
  );
}

// DELETE /api/memos/[memoId] — 메모 하드 삭제
// 멱등(idempotent): 0건 삭제여도 200. RLS relation_memos_own 이 소유자 스코프를 enforce.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ memoId: string }> },
): Promise<NextResponse> {
  const { memoId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const db = supabase;
  const { error } = await db.from('relation_memos').delete().eq('memo_id', memoId);
  if (error) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  return NextResponse.json({ ok: true }, { status: 200 });
}
