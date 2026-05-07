import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import type { FeedItem, RelationErrorCode } from '@/types/relation';
import { CHANGE_SCORE_THRESHOLD } from '@/lib/scoring/constants';
import { computeChangeScore } from '@/lib/scoring/changeScore';

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

  // 1. 인연 목록 (created_at desc)
  const { data: relations, error: relErr } = await db
    .from('relations')
    .select('relation_id, nickname, mode, created_at')
    .order('created_at', { ascending: false });
  if (relErr) return errorResponse('INTERNAL_ERROR', 500);

  // 2. 사용자 전체 스냅샷 — 단일 round-trip (RLS가 user_id 필터, 인덱스 활용)
  const { data: snapshots, error: snapErr } = await db
    .from('hapcard_score_snapshots')
    .select('relation_id, mode, compat_score, created_at')
    .order('created_at', { ascending: false });
  if (snapErr) return errorResponse('INTERNAL_ERROR', 500);

  // 3. (relation_id::mode) 키별 최신 2건만 유지 (already sorted desc)
  type SnapRow = { relation_id: string; mode: string; compat_score: number };
  const byKey = new Map<string, Array<{ compat_score: number }>>();
  for (const s of (snapshots ?? []) as SnapRow[]) {
    const key = `${s.relation_id}::${s.mode}`;
    const arr = byKey.get(key) ?? [];
    if (arr.length < 2) arr.push({ compat_score: Number(s.compat_score) });
    byKey.set(key, arr);
  }

  // 4. FeedItem 조립
  type RelRow = { relation_id: string; nickname: string; mode: string; created_at: string };
  const items: FeedItem[] = (relations ?? []).map((r: RelRow) => {
    const pair = byKey.get(`${r.relation_id}::${r.mode}`) ?? [];
    const latest = pair[0]?.compat_score ?? null;
    const prev = pair[1]?.compat_score ?? null;
    const change_score = latest === null ? 0 : computeChangeScore(prev, latest);
    return {
      relation_id: r.relation_id,
      nickname: r.nickname,
      mode: r.mode as FeedItem['mode'],
      compat_score: latest,
      change_score,
      has_significant_change: Math.abs(change_score) >= CHANGE_SCORE_THRESHOLD,
      created_at: r.created_at,
    };
  });

  // 5. ADR-036 정렬: 변화 큼 우선, 그 외 created_at desc는 이미 유지됨 (stable sort)
  items.sort((a, b) => {
    if (a.has_significant_change !== b.has_significant_change) {
      return a.has_significant_change ? -1 : 1;
    }
    return 0;
  });

  return NextResponse.json({ items });
}
