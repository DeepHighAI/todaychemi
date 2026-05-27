import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { POST } from '@/app/api/me/delete-request/route';
import { createClient as createServerClient } from '@/lib/supabase/server';

function makeClient(opts: {
  userId?: string | null;
  profile?: { user_id: string; deletion_requested_at: string | null } | null;
  profileError?: { message: string } | null;
  updateError?: { message: string } | null;
}) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: opts.userId === null ? null : { id: opts.userId ?? 'user-1' } },
    error: null,
  });

  const maybeSingle = vi.fn().mockResolvedValue({
    data: opts.profile === undefined ? { user_id: 'user-1', deletion_requested_at: null } : opts.profile,
    error: opts.profileError ?? null,
  });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });

  const updateEq = vi.fn().mockResolvedValue({ data: null, error: opts.updateError ?? null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const from = vi.fn().mockReturnValue({ select, update });

  return { auth: { getUser }, from, _update: update, _updateEq: updateEq };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/me/delete-request', () => {
  it('401 → 미인증 사용자를 차단한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient({ userId: null }) as never);

    const res = await POST();

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('404 → 온보딩 전 사용자를 차단한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient({ profile: null }) as never);

    const res = await POST();

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_ONBOARDED');
  });

  it('이미 요청된 계정은 기존 deletion_requested_at을 멱등 반환한다', async () => {
    const client = makeClient({
      profile: { user_id: 'user-1', deletion_requested_at: '2026-05-25T00:00:00.000Z' },
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.already_requested).toBe(true);
    expect(body.deletion_requested_at).toBe('2026-05-25T00:00:00.000Z');
    expect(client._update).not.toHaveBeenCalled();
  });

  it('users.deletion_requested_at을 기록한다', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.already_requested).toBe(false);
    expect(client._update).toHaveBeenCalledWith(
      expect.objectContaining({
        deletion_requested_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
    expect(client._updateEq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('DB update 실패 시 500을 반환한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClient({ updateError: { message: 'db down' } }) as never,
    );

    const res = await POST();

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('INTERNAL_ERROR');
  });
});
