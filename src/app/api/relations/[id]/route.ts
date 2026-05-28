import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import type { FlowPoint, RelationDetailResponse } from '@/types/relation';

const FLOW_MAX = 30;

// GET /api/relations/[id] — 인연 디테일(별명·모드·합흐름·본명식 차트) 조회
// RLS relations_own(for all) 이 소유자 스코프를 enforce.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const db = supabase as unknown as SupabaseClient;

  // 1. 인연 조회 (RLS가 타 소유자 차단 — null 반환)
  const relRes = await db
    .from('relations')
    .select('relation_id, nickname, mode, created_at')
    .eq('relation_id', id)
    .maybeSingle();
  if (!relRes.data) {
    return apiErrorResponse('RELATION_NOT_FOUND', `relation ${id} not found`, 404);
  }
  const relation = relRes.data as RelationDetailResponse['relation'];

  // 2. 본명식 차트 조회 (없으면 null)
  const chartRes = await db
    .from('relation_charts')
    .select('chart_core')
    .eq('relation_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const chart = (chartRes.data?.chart_core as RelationDetailResponse['chart']) ?? null;

  // 3. 합점수 흐름 조회 — 날짜별 dedup(created_at desc 첫 행), asc, FLOW_MAX 상한
  const snapRes = await db
    .from('hapcard_score_snapshots')
    .select('target_date, compat_score, created_at')
    .eq('relation_id', id)
    .eq('mode', relation.mode)
    .order('target_date', { ascending: true })
    .order('created_at', { ascending: false });

  if (snapRes.error) {
    return apiErrorResponse('INTERNAL_ERROR', snapRes.error.message, 500);
  }

  // 같은 날짜 여러 행 → 이미 target_date asc + created_at desc 이므로 같은 날 첫 행이 최신
  // 그러나 asc 정렬이라 같은 날 안에서 created_at 순서가 섞일 수 있어 Map 으로 dedup
  const scoreMap = new Map<string, number>();
  for (const row of (snapRes.data ?? []) as Array<{ target_date: string; compat_score: number; created_at: string }>) {
    // 이미 target_date asc + created_at desc 정렬 — created_at 가 더 최신인 행이 먼저 등장하지 않을 수 있어
    // 안전하게 전체 순회 후 각 날짜별 최대 created_at 행을 선택
    if (!scoreMap.has(row.target_date)) {
      scoreMap.set(row.target_date, Number(row.compat_score));
    }
  }

  const flow: FlowPoint[] = Array.from(scoreMap.entries())
    .slice(0, FLOW_MAX)
    .map(([date, score]) => ({ date, score }));

  return NextResponse.json(
    { relation, chart, flow } satisfies RelationDetailResponse,
    { status: 200 },
  );
}

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
