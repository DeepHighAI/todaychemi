import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { GET } from '@/app/api/me/export/route';
import { createClient as createServerClient } from '@/lib/supabase/server';

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

const PROFILE = {
  user_id: 'user-1',
  nickname: '하늘달',
  birth_date: '1991-03-15',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact',
  birth_time: '14:30',
  gender: 'F',
  consented_at: '2026-05-25T00:00:00Z',
  consented_tos_version: '2026-06-01',
  consented_privacy_version: '2026-06-01',
  age_confirmed: true,
  deletion_requested_at: null,
  created_at: '2026-05-25T00:00:00Z',
  updated_at: '2026-05-25T00:00:00Z',
};

function makeClient(opts: {
  userId?: string | null;
  tableResults?: Record<string, QueryResult>;
}) {
  const getUser = vi.fn().mockResolvedValue({
    data: {
      user: opts.userId === null
        ? null
        : { id: opts.userId ?? 'user-1', email: 'user@example.com' },
    },
    error: null,
  });

  const tableResults = opts.tableResults ?? {
    users: { data: PROFILE, error: null },
  };
  const from = vi.fn().mockImplementation((table: string) => {
    const result = tableResults[table] ?? { data: [], error: null };
    const order = vi.fn().mockResolvedValue(result);
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const eq = vi.fn().mockReturnValue({ order, maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    return { select };
  });

  return { auth: { getUser }, from };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/me/export', () => {
  it('401 → 미인증 사용자를 차단한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient({ userId: null }) as never);

    const res = await GET();

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('404 → profile row가 없으면 export를 만들지 않는다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClient({ tableResults: { users: { data: null, error: null } } }) as never,
    );

    const res = await GET();

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_ONBOARDED');
  });

  it('200 → JSON attachment로 사용자 데이터를 내려준다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClient({
        tableResults: {
          users: { data: PROFILE, error: null },
          relations: { data: [{ relation_id: 'rel-1', nickname: '인연' }], error: null },
          payments: { data: [{ payment_id: 'pay-1', amount_krw: 4900 }], error: null },
        },
      }) as never,
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment;');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body.user.email).toBe('user@example.com');
    expect(body.profile.nickname).toBe('하늘달');
    expect(body.relations).toEqual([{ relation_id: 'rel-1', nickname: '인연' }]);
    expect(body.payments).toEqual([{ payment_id: 'pay-1', amount_krw: 4900 }]);
  });

  it('from 메서드를 this 바인딩 없이 추출해도 정상 동작한다', async () => {
    // 실제 Supabase client의 from()은 내부에서 this를 참조한다.
    // db.from을 바인딩 없이 추출하면 TypeError가 발생하는 회귀를 방지한다.
    class FakeClientWithThis {
      private _ready = true;
      from(table: string) {
        if (!this._ready) throw new TypeError('this is unbound');
        const result = table === 'users' ? { data: PROFILE, error: null } : { data: [], error: null };
        const order = vi.fn().mockResolvedValue(result);
        const maybeSingle = vi.fn().mockResolvedValue(result);
        const eq = vi.fn().mockReturnValue({ order, maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      auth = {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u1', email: 'bound@test.com' } },
          error: null,
        }),
      };
    }
    vi.mocked(createServerClient).mockResolvedValue(new FakeClientWithThis() as never);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.nickname).toBe('하늘달');
  });

  it('조회 중 DB 오류가 있으면 500을 반환한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClient({
        tableResults: {
          users: { data: PROFILE, error: null },
          relations: { data: null, error: { message: 'db down' } },
        },
      }) as never,
    );

    const res = await GET();

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('INTERNAL_ERROR');
  });
});
