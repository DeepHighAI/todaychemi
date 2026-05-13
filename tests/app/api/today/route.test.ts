import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/today/builder');
vi.mock('@/lib/llm/clients');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { buildDailyHap } from '@/lib/today/builder';
import { GET } from '@/app/api/today/route';
import type { DailyHapCard } from '@/types/dailyHap';

const CARD: DailyHapCard = {
  headline: '오늘은 집중력이 좋아요.',
  headline_reason: '木기운.',
  avoid_phrase: '충동 발언',
  avoid_phrase_reason: '火 충돌.',
  favorable_action: '집중 작업',
  favorable_action_reason: '木 활용.',
  reused_from_yesterday: false,
};

function makeClient(userId: string | null = 'user-001') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildDailyHap).mockResolvedValue(CARD);
});

describe('GET /api/today', () => {
  it('200 → buildDailyHap 반환 카드', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.card.headline).toBe(CARD.headline);
  });

  it('200 → card=null (3순위 폴백 — 섹션 숨김)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(buildDailyHap).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.card).toBeNull();
  });

  it('401 → UNAUTHORIZED (미인증)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(vi.mocked(buildDailyHap)).not.toHaveBeenCalled();
  });

  it('500 → INTERNAL_ERROR (buildDailyHap throw)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    vi.mocked(buildDailyHap).mockRejectedValue(new Error('DB down'));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
