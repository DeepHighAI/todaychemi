import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { SCORING_VERSION } from '@/lib/scoring/constants';
import { computeChangeScore, topChangedFactors } from '@/lib/scoring/changeScore';
import type { ScoreBreakdown } from '@/types/hapcard';
import type { HapcardChangeResponse } from '@/types/hapcard';

// GET /api/hapcards/[id]/change — H-2 변화 폭 인디케이터 (ADR-033/036)
// 케미카드(현재)를 같은 인연·모드의 직전 해석과 비교해 ±점수 + 변화 요인을 반환한다.
// ADR-036: scoring_version·prompt_version 이 다른 스냅샷과는 비교 금지(version_changed).
// 점수 본체에 LLM 미개입(ADR-035) — 결정형 score_breakdown 차분만.
type SnapRow = {
  target_date: string;
  prompt_version: string;
  scoring_version: string;
  compat_score: number;
  score_breakdown: ScoreBreakdown;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return apiErrorResponse('UNAUTHORIZED', 'sign-in required', 401);
  }

  // 1. 케미카드 조회 (RLS가 user_id enforce — 타 소유자면 null). 현재 값의 authoritative source.
  const cardRes = await supabase
    .from('hapcards')
    .select('relation_id, mode, target_date, prompt_version, compat_score, score_breakdown')
    .eq('hapcard_id', id)
    .maybeSingle();
  if (cardRes.error) {
    return apiErrorResponse('INTERNAL_ERROR', cardRes.error.message, 500);
  }
  if (!cardRes.data) {
    return apiErrorResponse('HAPCARD_NOT_FOUND', `hapcard ${id} not found`, 404);
  }
  // jsonb score_breakdown(Json) → ScoreBreakdown 은 코드베이스 허용 이중 캐스트 패턴 (chart-row 사례).
  // builder 가 항상 5개 숫자 키로 기록하므로 shape 보장.
  const card = cardRes.data as unknown as {
    relation_id: string;
    mode: string;
    target_date: string;
    prompt_version: string;
    compat_score: number;
    score_breakdown: ScoreBreakdown;
  };

  // 2. 같은 인연·모드의 현재일 이하 스냅샷을 최신순 조회 (단일 round-trip).
  const snapRes = await supabase
    .from('hapcard_score_snapshots')
    .select('target_date, prompt_version, scoring_version, compat_score, score_breakdown')
    .eq('relation_id', card.relation_id)
    .eq('mode', card.mode)
    .lte('target_date', card.target_date)
    .order('target_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (snapRes.error) {
    return apiErrorResponse('INTERNAL_ERROR', snapRes.error.message, 500);
  }
  const rows = (snapRes.data ?? []) as unknown as SnapRow[];

  // 3. 현재 스냅샷(= card.target_date)에서 현재 scoring_version 을 확정. 부재 시 코드 상수로 폴백.
  const currentSnap =
    rows.find((r) => r.target_date === card.target_date && r.prompt_version === card.prompt_version) ??
    rows.find((r) => r.target_date === card.target_date) ??
    null;
  const currentScoringVersion = currentSnap?.scoring_version ?? String(SCORING_VERSION);

  // 4. 직전 해석 = 더 오래된 날짜(target_date < card.target_date)의 첫 행 (이미 desc 정렬).
  const previous = rows.find((r) => r.target_date < card.target_date) ?? null;

  let response: HapcardChangeResponse;
  if (!previous) {
    response = { status: 'first', delta: null, factors: [] };
  } else if (
    previous.scoring_version !== currentScoringVersion ||
    previous.prompt_version !== card.prompt_version
  ) {
    // ADR-036: 버전이 다르면 직접 비교 금지
    response = { status: 'version_changed', delta: null, factors: [] };
  } else {
    response = {
      status: 'comparable',
      delta: computeChangeScore(previous.compat_score, card.compat_score),
      factors: topChangedFactors(previous.score_breakdown, card.score_breakdown),
    };
  }

  return NextResponse.json(response, { status: 200 });
}
