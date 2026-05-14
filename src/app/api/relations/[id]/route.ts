import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/errors/route-response';

// DELETE /api/relations/[id] — 인연 하드 삭제
// RLS relations_own(for all)이 소유자 스코프를 enforce. relations 행 삭제 시
// relation_charts / hapcards / hapcard_score_snapshots 는 ON DELETE CASCADE 로 정리됨.
// 멱등(idempotent): 0건 삭제여도 200 — 호출 측(Today·Feed·Hapcard)은 res.ok 만 확인.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const db = supabase as unknown as SupabaseClient;
  const { error } = await db.from('relations').delete().eq('relation_id', id);
  if (error) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  return NextResponse.json({ ok: true }, { status: 200 });
}
