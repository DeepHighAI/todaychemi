import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import type { FeedItem, RelationErrorCode } from '@/types/relation';
import { CHANGE_SCORE_THRESHOLD } from '@/lib/scoring/constants';
import { computeChangeScore } from '@/lib/scoring/changeScore';
import { todayKST } from '@/lib/today/kst-date';

function kstDateDaysAgo(days: number): string {
  const [year, month, day] = todayKST().split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const db = supabase;

  // 1. 인연 목록 (created_at desc)
  const { data: relations, error: relErr } = await db
    .from('relations')
    .select('relation_id, nickname, mode, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (relErr) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  // 2. 사용자 전체 스냅샷 — KST target_date 기준 단일 round-trip
  const thirtyDaysAgo = kstDateDaysAgo(30);
  const { data: snapshots, error: snapErr } = await db
    .from('hapcard_score_snapshots')
    .select('relation_id, mode, compat_score, scoring_version, target_date, created_at')
    .gte('target_date', thirtyDaysAgo)
    .order('target_date', { ascending: false })
    .order('created_at', { ascending: false })
    // .gte 30일 윈도우 + limit(1000): 비활성 사용자 데이터 제외, Supabase Free 규모에서 충분
    .limit(1000);
  if (snapErr) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  // 3. (relation_id::mode) 키별 target_date 최신 2건만 유지 (already sorted desc)
  type SnapRow = {
    relation_id: string;
    mode: string;
    compat_score: number;
    scoring_version: string | null;
    target_date: string;
  };
  const byKey = new Map<string, Array<{ compat_score: number; scoring_version: string | null }>>();
  for (const s of (snapshots ?? []) as SnapRow[]) {
    const key = `${s.relation_id}::${s.mode}`;
    const arr = byKey.get(key) ?? [];
    if (arr.length < 2) {
      arr.push({ compat_score: Number(s.compat_score), scoring_version: s.scoring_version ?? null });
    }
    byKey.set(key, arr);
  }

  // 4. FeedItem 조립
  type RelRow = { relation_id: string; nickname: string; mode: string; created_at: string };
  const items: FeedItem[] = (relations ?? []).map((r: RelRow) => {
    const pair = byKey.get(`${r.relation_id}::${r.mode}`) ?? [];
    const latestSnap = pair[0] ?? null;
    const prevSnap = pair[1] ?? null;
    const latest = latestSnap?.compat_score ?? null;
    // ADR-036: scoring_version 이 다른 스냅샷 간 점수 비교 금지 — 불일치 시 변화량 미산출 (badge 스킵)
    const prevComparable =
      latestSnap !== null &&
      prevSnap !== null &&
      latestSnap.scoring_version === prevSnap.scoring_version;
    const prev = prevComparable ? prevSnap.compat_score : null;
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
