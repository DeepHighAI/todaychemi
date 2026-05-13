import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient as createServerClient } from '@/lib/supabase/server';
import type {
  HapcardSnapshotEntry,
  HapcardSnapshotsResponse,
  SnapshotsErrorCode,
} from '@/types/hapcard';
import { apiErrorResponse } from '@/lib/errors/route-response';

function todayKST(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // 1. 인증 확인
  const supabase = await createServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return apiErrorResponse('UNAUTHORIZED', 'sign-in required', 401);
  }

  // 2. hapcard 조회 (RLS가 user_id 자동 enforce — 타 사용자 소유면 null 반환)
  const hapcardRes = await supabase
    .from('hapcards')
    .select('relation_id, mode')
    .eq('hapcard_id', id)
    .maybeSingle();
  if (!hapcardRes.data) {
    return apiErrorResponse('HAPCARD_NOT_FOUND', `hapcard ${id} not found`, 404);
  }
  const { relation_id, mode } = hapcardRes.data as { relation_id: string; mode: string };

  // 3. D-3 ~ D+3 윈도우 스냅샷 조회 — 단일 round-trip, RLS가 user_id enforce
  const today = todayKST();
  const start = addDays(today, -3);
  const end = addDays(today, 3);

  const db = supabase as unknown as SupabaseClient;
  const { data: rows, error: snapErr } = await db
    .from('hapcard_score_snapshots')
    .select('target_date, compat_score, created_at')
    .eq('relation_id', relation_id)
    .eq('mode', mode)
    .gte('target_date', start)
    .lte('target_date', end)
    .order('target_date', { ascending: true })
    .order('created_at', { ascending: false });

  if (snapErr) {
    return apiErrorResponse('INTERNAL_ERROR', snapErr.message, 500);
  }

  // 4. 같은 날짜의 여러 행 → ORDER BY created_at desc로 이미 정렬돼 있으므로 첫 행 채택
  const scoreMap = new Map<string, number>();
  for (const row of (rows ?? []) as Array<{ target_date: string; compat_score: number }>) {
    if (!scoreMap.has(row.target_date)) {
      scoreMap.set(row.target_date, Number(row.compat_score));
    }
  }

  // 5. 7칸 배열 생성 — 미래 날짜는 row가 없으므로 score=null
  const snapshots: HapcardSnapshotEntry[] = [];
  for (let i = -3; i <= 3; i++) {
    const date = addDays(today, i);
    snapshots.push({ date, score: scoreMap.get(date) ?? null });
  }

  return NextResponse.json({ snapshots, today_index: 3 } satisfies HapcardSnapshotsResponse, {
    status: 200,
  });
}
