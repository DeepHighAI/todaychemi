import { describe, it, expect, vi } from 'vitest';
import { pickTodayRelation } from '@/lib/today/relation-picker';

// G2 / Phase 3 C7 — 오늘카드 인연 자동 선택
// - preferredRelationId 있으면: 그 인연이 사용자 소유면 반환, 아니면 fallback
// - preferredRelationId 없으면: 사용자의 최근 등록된 인연 1건
// - 인연 0건이면 null

interface RelationRow {
  relation_id: string;
  nickname: string;
  mode: string;
  user_id: string;
  created_at: string;
}

function makeSupabase(rows: RelationRow[]) {
  // chainable mock — .from().select().eq().eq().order().limit().maybeSingle()
  // 또는 .from().select().eq().order().limit().maybeSingle()
  // 호출 시퀀스에 따라 적절한 row 반환.
  const calls: { table?: string; preferred?: string } = {};
  return {
    from: vi.fn((table: string) => {
      calls.table = table;
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((col: string, val: string) => {
          if (col === 'relation_id') calls.preferred = val;
          return builder;
        }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => {
          if (calls.preferred) {
            const found = rows.find((r) => r.relation_id === calls.preferred && r.user_id === 'user-1');
            calls.preferred = undefined;
            return { data: found ?? null, error: null };
          }
          return { data: rows[0] ?? null, error: null };
        }),
      };
      return builder;
    }),
  };
}

describe('pickTodayRelation', () => {
  it('인연 0건 → null', async () => {
    const supabase = makeSupabase([]);
    const result = await pickTodayRelation(supabase as never, 'user-1', undefined);
    expect(result).toBeNull();
  });

  it('preferredRelationId 없음 → 최근 등록된 인연 1건 반환', async () => {
    const supabase = makeSupabase([
      { relation_id: 'rel-new', nickname: '민지', mode: '일합', user_id: 'user-1', created_at: '2026-05-20' },
      { relation_id: 'rel-old', nickname: '지수', mode: '친구합', user_id: 'user-1', created_at: '2026-05-01' },
    ]);
    const result = await pickTodayRelation(supabase as never, 'user-1', undefined);
    expect(result).toEqual({ id: 'rel-new', nickname: '민지', mode: '일합' });
  });

  it('preferredRelationId 있고 사용자 소유 → 그 인연 반환 (자동 선택 우선)', async () => {
    const supabase = makeSupabase([
      { relation_id: 'rel-new', nickname: '민지', mode: '일합', user_id: 'user-1', created_at: '2026-05-20' },
      { relation_id: 'rel-pref', nickname: '하나', mode: '오래합', user_id: 'user-1', created_at: '2026-05-15' },
    ]);
    const result = await pickTodayRelation(supabase as never, 'user-1', 'rel-pref');
    expect(result).toEqual({ id: 'rel-pref', nickname: '하나', mode: '오래합' });
  });

  it('preferredRelationId 있지만 다른 유저 소유 → null 처리 후 fallback (가장 최근 인연)', async () => {
    const supabase = makeSupabase([
      { relation_id: 'rel-mine', nickname: '민지', mode: '일합', user_id: 'user-1', created_at: '2026-05-20' },
    ]);
    const result = await pickTodayRelation(supabase as never, 'user-1', 'rel-other-user');
    // preferred 매칭 실패 → 최근 인연으로 fallback
    expect(result).toEqual({ id: 'rel-mine', nickname: '민지', mode: '일합' });
  });

  it('preferredRelationId 있지만 다른 유저 소유 + 사용자 인연도 0건 → null', async () => {
    const supabase = makeSupabase([]);
    const result = await pickTodayRelation(supabase as never, 'user-1', 'rel-other');
    expect(result).toBeNull();
  });
});
