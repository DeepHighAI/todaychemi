import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import type { Mode } from '@/types/mode';
import type { RelationTimelineEvent, RelationTimelineResponse } from '@/types/relation';

const TIMELINE_EVENT_MAX = 50;

// GET /api/relations/[id]/timeline — 인연 이력 타임라인 집계 (S-09, PRD §5.2)
// 등록(relations.created_at)·케미카드(hapcards)·케미 다시 맞추기(hapcard_replays)를 최신순 병합.
// §1.1 2026-06-13: 메모는 타임라인 제외(별도 섹션 유지)·최신순(desc)·v1 표시 전용.
// RLS relations_own 이 소유자 스코프를 enforce. 메타데이터만 반환(본문·점수 미포함) —
// ADR-039 read-path 본문 게이트 비대상 범위.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const db = supabase;

  // 1. 인연 조회 (RLS가 타 소유자 차단 — null 반환)
  const relRes = await db
    .from('relations')
    .select('relation_id, created_at')
    .eq('relation_id', id)
    .maybeSingle();
  if (relRes.error) {
    return apiErrorResponse('INTERNAL_ERROR', relRes.error.message, 500);
  }
  if (!relRes.data) {
    return apiErrorResponse('RELATION_NOT_FOUND', `relation ${id} not found`, 404);
  }
  const relation = relRes.data as { relation_id: string; created_at: string };

  // 2. 케미카드 이벤트 — 메타데이터만 선택 (content·compat_score 미포함)
  const cardsRes = await db
    .from('hapcards')
    .select('hapcard_id, mode, created_at')
    .eq('relation_id', id);
  if (cardsRes.error) {
    return apiErrorResponse('INTERNAL_ERROR', cardsRes.error.message, 500);
  }
  const cards = (cardsRes.data ?? []) as Array<{
    hapcard_id: string;
    mode: Mode;
    created_at: string;
  }>;

  // 3. 다시 맞추기 이벤트 — relation 직접 FK 가 없어 hapcard_id 경유
  let replays: Array<{ replay_id: string; hapcard_id: string; created_at: string }> = [];
  if (cards.length > 0) {
    const replaysRes = await db
      .from('hapcard_replays')
      .select('replay_id, hapcard_id, created_at')
      .in('hapcard_id', cards.map((card) => card.hapcard_id));
    if (replaysRes.error) {
      return apiErrorResponse('INTERNAL_ERROR', replaysRes.error.message, 500);
    }
    replays = (replaysRes.data ?? []) as typeof replays;
  }

  const modeByCard = new Map(cards.map((card) => [card.hapcard_id, card.mode]));

  // 병합 → 최신순(desc) → 상한. 등록 이벤트는 항상 가장 오래된 이벤트이므로
  // 상한과 무관하게 마지막에 고정 포함한다.
  const events: RelationTimelineEvent[] = [
    ...cards.map((card): RelationTimelineEvent => ({
      type: 'hapcard',
      occurred_at: card.created_at,
      mode: card.mode,
    })),
    ...replays.map((replay): RelationTimelineEvent => ({
      type: 'replay',
      occurred_at: replay.created_at,
      mode: modeByCard.get(replay.hapcard_id) ?? null,
    })),
  ]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, TIMELINE_EVENT_MAX);

  events.push({
    type: 'registered',
    occurred_at: relation.created_at,
    mode: null,
  });

  return NextResponse.json(
    { events } satisfies RelationTimelineResponse,
    { status: 200 },
  );
}
