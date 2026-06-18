/**
 * /api/toss/consent route 단위 테스트.
 *
 * supabase server client(getUser) + service-role client(legal_consents insert) 를 mock.
 * createClaimedLegalConsentRecord 는 실제 함수를 사용해 insert row 형태(flow='toss')를 검증.
 * 네트워크 / DB 불필요. (iap/unlock 패턴 미러)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── mock 선언은 import 보다 먼저 ──────────────────────────────────────────────
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');

import { POST } from '@/app/api/toss/consent/route';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from '@/lib/legal/consent';

// ---------------------------------------------------------------------------
// 픽스처
// ---------------------------------------------------------------------------

const USER_ID = 'user-toss-consent-001';
const BEARER_TOKEN = 'supabase-access-token-toss';
const VALID_BODY = { terms: true, privacy: true, age: true } as const;

// ---------------------------------------------------------------------------
// Supabase mock 헬퍼
// ---------------------------------------------------------------------------

function makeAuthClient(userId: string | null = USER_ID) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: userId ? null : { message: 'invalid token' },
      }),
    },
  };
}

/** service-role legal_consents insert-capture 체인 */
function makeServiceClient() {
  const captured: { row?: Record<string, unknown> } = {};
  const single = vi.fn().mockResolvedValue({
    data: {
      consent_id: 'consent-uuid-001',
      auth_user_id: USER_ID,
      flow: 'toss',
      provider: null,
      terms_version: LEGAL_TERMS_VERSION,
      privacy_version: LEGAL_PRIVACY_VERSION,
      age_confirmed: true,
      consented_at: '2026-06-18T00:00:00.000Z',
      expires_at: '2026-06-18T00:30:00.000Z',
      claimed_at: '2026-06-18T00:00:00.000Z',
    },
    error: null,
  });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockImplementation((row: Record<string, unknown>) => {
    captured.row = row;
    return { select };
  });
  const from = vi.fn().mockReturnValue({ insert });
  return { client: { from } as never, from, insert, captured };
}

// ---------------------------------------------------------------------------
// 요청 헬퍼
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, token: string | null = BEARER_TOKEN): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request('http://localhost/api/toss/consent', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

let service: ReturnType<typeof makeServiceClient>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerClient).mockResolvedValue(makeAuthClient() as never);
  service = makeServiceClient();
  vi.mocked(createServiceRoleClient).mockReturnValue(service.client);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 인증
// ---------------------------------------------------------------------------

describe('POST /api/toss/consent — 인증', () => {
  it('Authorization 헤더 없음 → 401 UNAUTHORIZED', async () => {
    const res = await POST(makeRequest(VALID_BODY, null));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('유효하지 않은 Bearer 토큰 → 401 UNAUTHORIZED', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeAuthClient(null) as never);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// Zod 검증 — 400
// ---------------------------------------------------------------------------

describe('POST /api/toss/consent — 유효성 검증', () => {
  it('terms=false → 400 INVALID_BODY', async () => {
    const res = await POST(makeRequest({ terms: false, privacy: true, age: true }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_BODY');
  });

  it('빈 body → 400 INVALID_BODY', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_BODY');
  });

  it('age 누락 → 400 INVALID_BODY', async () => {
    const res = await POST(makeRequest({ terms: true, privacy: true }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 정상 흐름
// ---------------------------------------------------------------------------

describe('POST /api/toss/consent — 정상 흐름', () => {
  it('성공 → 200 { ok, consented_at } + flow=toss claimed 행 기록', async () => {
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; consented_at: string };
    expect(body.ok).toBe(true);
    expect(body.consented_at).toBe('2026-06-18T00:00:00.000Z');

    expect(service.from).toHaveBeenCalledWith('legal_consents');
    const row = service.captured.row as Record<string, unknown>;
    expect(row.flow).toBe('toss');
    expect(row.provider).toBeNull();
    expect(row.auth_user_id).toBe(USER_ID);
    expect(row.age_confirmed).toBe(true);
    expect(row.claimed_at).toEqual(expect.any(String));
    expect(row.terms_version).toBe(LEGAL_TERMS_VERSION);
    // 원본 nonce 토큰은 절대 저장하지 않는다(해시만).
    expect(row.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row).not.toHaveProperty('token');
  });
});
