/**
 * /api/toss/disconnect route 단위 테스트.
 *
 * Basic Auth 검증, referrer 분기, 멱등성, 2xx 반환을 검증한다.
 * 특히 매핑(toss_connections) 행이 삭제되지 않음을 단언한다.
 * 네트워크/Supabase 없이 service-role mock 으로만 검증.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('TOSS_DISCONNECT_BASIC_AUTH', 'todaychemi:supersecret');

vi.mock('@/lib/supabase/service-role');

import { GET, POST } from '@/app/api/toss/disconnect/route';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

// ---------------------------------------------------------------------------
// Basic Auth 헤더 생성 헬퍼
// ---------------------------------------------------------------------------

function makeBasicAuth(credentials: string) {
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

const VALID_AUTH = makeBasicAuth('todaychemi:supersecret');
const INVALID_AUTH = makeBasicAuth('wrong:credentials');

// ---------------------------------------------------------------------------
// mock 팩토리
// ---------------------------------------------------------------------------

function makeAdminClient(opts: {
  connData?: { user_id: string } | null;
  connError?: unknown;
  signOutError?: { message: string } | null;
  /** users 행(삭제 마킹 select 결과). null = 미온보딩 */
  userProfile?: { deletion_requested_at: string | null } | null;
} = {}) {
  const {
    connData = null,
    connError = null,
    signOutError = null,
    userProfile = { deletion_requested_at: null },
  } = opts;

  // ── toss_connections 체인 ──
  const connMaybeSingle = vi.fn().mockResolvedValue({ data: connData, error: connError });
  const connEq = vi.fn().mockReturnValue({ maybeSingle: connMaybeSingle });
  const connSelect = vi.fn().mockReturnValue({ eq: connEq });

  // ── users 체인 (deletion_requested_at select + update) ──
  const userMaybeSingle = vi.fn().mockResolvedValue({ data: userProfile, error: null });
  const userSelectEq = vi.fn().mockReturnValue({ maybeSingle: userMaybeSingle });
  const userSelect = vi.fn().mockReturnValue({ eq: userSelectEq });
  const updateEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateFn = vi.fn().mockReturnValue({ eq: updateEq });

  // delete 메서드 — 매핑 행 미삭제 단언용 spy
  const eqDelete = vi.fn().mockResolvedValue({ data: null, error: null });
  const deleteFn = vi.fn().mockReturnValue({ eq: eqDelete });

  const signOut = vi.fn().mockResolvedValue({ error: signOutError });

  const from = vi.fn().mockImplementation((table: string) =>
    table === 'users'
      ? { select: userSelect, update: updateFn, delete: deleteFn }
      : { select: connSelect, delete: deleteFn },
  );

  return {
    from,
    deleteFn, // 매핑 삭제 단언용
    updateFn, // deletion_requested_at 설정 단언용
    auth: {
      admin: { signOut },
    },
  };
}

// ---------------------------------------------------------------------------
// 헬퍼 — Request 생성
// ---------------------------------------------------------------------------

function makePostRequest(
  body: unknown,
  authHeader?: string,
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authHeader) headers['authorization'] = authHeader;

  return new Request('http://localhost/api/toss/disconnect', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function makeGetRequest(
  params: Record<string, string>,
  authHeader?: string,
) {
  const url = new URL('http://localhost/api/toss/disconnect');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const headers: Record<string, string> = {};
  if (authHeader) headers['authorization'] = authHeader;

  return new Request(url.toString(), { method: 'GET', headers });
}

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/toss/disconnect', () => {
  describe('Basic Auth 검증', () => {
    it('올바른 Basic Auth + 유효 payload 시 200 반환', async () => {
      const adminMock = makeAdminClient({ connData: { user_id: 'uid-001' } });
      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);

      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'UNLINK' },
        VALID_AUTH,
      ));

      expect(res.status).toBe(200);
    });

    it('Basic Auth 미전달 시 401 반환', async () => {
      const res = await POST(makePostRequest({ userKey: 443731103, referrer: 'UNLINK' }));
      expect(res.status).toBe(401);
    });

    it('잘못된 Basic Auth 시 401 반환', async () => {
      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'UNLINK' },
        INVALID_AUTH,
      ));
      expect(res.status).toBe(401);
    });
  });

  describe('payload 검증', () => {
    it('userKey 누락 시 400 반환', async () => {
      const res = await POST(makePostRequest({ referrer: 'UNLINK' }, VALID_AUTH));
      expect(res.status).toBe(400);
    });

    it('잘못된 referrer 시 400 반환', async () => {
      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'DEFAULT' },
        VALID_AUTH,
      ));
      expect(res.status).toBe(400);
    });
  });

  describe('referrer 분기', () => {
    it('UNLINK — 세션 무효화 + 데이터 보존(삭제 마킹 안 함) + 2xx', async () => {
      const adminMock = makeAdminClient({ connData: { user_id: 'uid-001' } });
      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);

      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'UNLINK' },
        VALID_AUTH,
      ));

      expect(res.status).toBe(200);
      // 세션 무효화는 수행
      expect(adminMock.auth.admin.signOut).toHaveBeenCalledWith('uid-001', 'global');
      // 매핑 삭제·삭제 마킹 모두 없음 (재로그인 시 이어쓰기)
      expect(adminMock.deleteFn).not.toHaveBeenCalled();
      expect(adminMock.updateFn).not.toHaveBeenCalled();
    });

    it('WITHDRAWAL_TERMS — 세션 무효화 + 데이터 보존(삭제 마킹 안 함) + 2xx', async () => {
      const adminMock = makeAdminClient({ connData: { user_id: 'uid-002' } });
      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);

      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'WITHDRAWAL_TERMS' },
        VALID_AUTH,
      ));

      expect(res.status).toBe(200);
      // 세션 무효화는 수행, 데이터/매핑 보존 (서버 처리는 UNLINK 와 동일)
      expect(adminMock.auth.admin.signOut).toHaveBeenCalled();
      expect(adminMock.deleteFn).not.toHaveBeenCalled();
      expect(adminMock.updateFn).not.toHaveBeenCalled();
    });

    it('WITHDRAWAL_TOSS — 세션 무효화 + deletion_requested_at 설정(30일 grace) + 2xx', async () => {
      const adminMock = makeAdminClient({
        connData: { user_id: 'uid-003' },
        userProfile: { deletion_requested_at: null }, // 아직 삭제 미요청
      });
      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);

      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'WITHDRAWAL_TOSS' },
        VALID_AUTH,
      ));

      expect(res.status).toBe(200);
      expect(adminMock.auth.admin.signOut).toHaveBeenCalled();
      // 계정삭제 정책 적용: deletion_requested_at UPDATE 호출
      expect(adminMock.updateFn).toHaveBeenCalledTimes(1);
      const updateArg = adminMock.updateFn.mock.calls[0][0] as Record<string, unknown>;
      expect(updateArg.deletion_requested_at).toEqual(expect.any(String));
      // 매핑은 직접 삭제하지 않음 (purge cron cascade 에 위임)
      expect(adminMock.deleteFn).not.toHaveBeenCalled();
    });

    it('WITHDRAWAL_TOSS — 이미 삭제 요청된 사용자면 멱등(중복 UPDATE 안 함)', async () => {
      const adminMock = makeAdminClient({
        connData: { user_id: 'uid-004' },
        userProfile: { deletion_requested_at: '2026-06-01T00:00:00.000Z' }, // 이미 요청됨
      });
      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);

      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'WITHDRAWAL_TOSS' },
        VALID_AUTH,
      ));

      expect(res.status).toBe(200);
      expect(adminMock.updateFn).not.toHaveBeenCalled();
    });

    it('WITHDRAWAL_TOSS — 미온보딩(프로필 없음)이면 삭제 마킹 생략 + 2xx', async () => {
      const adminMock = makeAdminClient({
        connData: { user_id: 'uid-005' },
        userProfile: null, // 미온보딩
      });
      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);

      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'WITHDRAWAL_TOSS' },
        VALID_AUTH,
      ));

      expect(res.status).toBe(200);
      expect(adminMock.updateFn).not.toHaveBeenCalled();
    });
  });

  describe('멱등성', () => {
    it('toss_connections 가 없어도 2xx 반환 (이미 해제된 상태)', async () => {
      const adminMock = makeAdminClient({ connData: null });
      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);

      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'UNLINK' },
        VALID_AUTH,
      ));

      expect(res.status).toBe(200);
      // 연결 없으면 signOut 호출하지 않음
      expect(adminMock.auth.admin.signOut).not.toHaveBeenCalled();
      // 삭제도 없음
      expect(adminMock.deleteFn).not.toHaveBeenCalled();
    });

    it('signOut 실패해도 2xx 반환 (세션 이미 만료 등)', async () => {
      const adminMock = makeAdminClient({
        connData: { user_id: 'uid-001' },
        signOutError: { message: 'session not found' },
      });
      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);

      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'UNLINK' },
        VALID_AUTH,
      ));

      expect(res.status).toBe(200);
    });
  });
});

describe('GET /api/toss/disconnect', () => {
  it('쿼리파라미터로 disconnect 처리 시 200 반환 + 매핑 삭제 없음', async () => {
    const adminMock = makeAdminClient({ connData: { user_id: 'uid-get-001' } });
    vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);

    const res = await GET(makeGetRequest(
      { userKey: '443731103', referrer: 'UNLINK' },
      VALID_AUTH,
    ));

    expect(res.status).toBe(200);
    expect(adminMock.auth.admin.signOut).toHaveBeenCalledWith('uid-get-001', 'global');
    // 매핑 행 삭제 없음
    expect(adminMock.deleteFn).not.toHaveBeenCalled();
  });

  it('GET — Basic Auth 누락 시 401 반환', async () => {
    const res = await GET(makeGetRequest({ userKey: '443731103', referrer: 'UNLINK' }));
    expect(res.status).toBe(401);
  });

  it('GET — userKey 누락 시 400 반환', async () => {
    const res = await GET(makeGetRequest({ referrer: 'UNLINK' }, VALID_AUTH));
    expect(res.status).toBe(400);
  });
});
