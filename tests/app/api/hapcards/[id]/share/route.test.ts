import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/share/token', () => ({
  generateShareToken: () => 'test-share-token',
  hashShareToken: () => 'hashed-token-digest',
}));

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { POST } from '@/app/api/hapcards/[id]/share/route';

const HAPCARD_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const RELATION_ID = '550e8400-e29b-41d4-a716-446655440088';

const insertedRows: unknown[] = [];

function makeUserClient(userId: string | null = USER_ID) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'hapcards') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({
                  data: {
                    hapcard_id: HAPCARD_ID,
                    user_id: USER_ID,
                    relation_id: RELATION_ID,
                    mode: '친구합',
                    compat_score: 78,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'relations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({
                  data: { nickname: '봄달', gender: 'F' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'relation_charts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { chart_core: { five_elements_counts: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 } } },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

function makeServiceClient() {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      expect(table).toBe('hapcard_shares');
      return {
        insert: (row: unknown) => {
          insertedRows.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({
                data: {
                  share_id: '550e8400-e29b-41d4-a716-446655440001',
                  expires_at: '2026-06-23T00:00:00.000Z',
                },
                error: null,
              }),
            }),
          };
        },
      };
    }),
  };
}

function makeRequest(body: unknown) {
  return new Request(`https://hap.plae/api/hapcards/${HAPCARD_ID}/share`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  insertedRows.length = 0;
  vi.mocked(createClient).mockResolvedValue(makeUserClient() as never);
  vi.mocked(createServiceRoleClient).mockReturnValue(makeServiceClient() as never);
});

describe('POST /api/hapcards/[id]/share', () => {
  it('creates 30-day public token share without exposing raw hapcard_id in URL', async () => {
    const res = await POST(makeRequest({ range: 'nickname-only', channel: 'kakao' }), {
      params: Promise.resolve({ id: HAPCARD_ID }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://hap.plae/h/test-share-token');
    expect(body.og_image_url).toBe('https://hap.plae/api/og/share/test-share-token');
    expect(body.url).not.toContain(HAPCARD_ID);

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toEqual(expect.objectContaining({
      token_hash: 'hashed-token-digest',
      range: 'nickname-only',
      channel: 'kakao',
      title: '봄달님과의 친구 관계',
    }));
    expect(JSON.stringify(insertedRows[0])).not.toContain('test-share-token');
  });

  it('401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(makeUserClient(null) as never);

    const res = await POST(makeRequest({ range: 'nickname-only', channel: 'kakao' }), {
      params: Promise.resolve({ id: HAPCARD_ID }),
    });

    expect(res.status).toBe(401);
  });

  it('400 for invalid range', async () => {
    const res = await POST(makeRequest({ range: 'birth-date', channel: 'kakao' }), {
      params: Promise.resolve({ id: HAPCARD_ID }),
    });

    expect(res.status).toBe(400);
  });

  it('outer catch 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    vi.mocked(createClient).mockRejectedValue(
      new Error('share failed birth_date=1991-03-15 birth_time=14:30 gender=F'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await POST(makeRequest({ range: 'nickname-only', channel: 'kakao' }), {
      params: Promise.resolve({ id: HAPCARD_ID }),
    });

    expect(res.status).toBe(500);
    const calls = JSON.stringify(consoleSpy.mock.calls);
    expect(calls).not.toContain('1991-03-15');
    expect(calls).not.toContain('14:30');
    expect(calls).not.toContain('gender=F');
    expect(calls).toContain('birth_date=[redacted]');
    expect(calls).toContain('birth_time=[redacted]');
    expect(calls).toContain('gender=[redacted]');
  });
});
