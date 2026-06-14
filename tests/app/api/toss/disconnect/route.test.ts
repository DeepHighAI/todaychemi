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
} = {}) {
  const {
    connData = null,
    connError = null,
    signOutError = null,
  } = opts;

  const maybeSingle = vi.fn().mockResolvedValue({
    data: connData,
    error: connError,
  });
  const eqConn = vi.fn().mockReturnValue({ maybeSingle });
  const selectFn = vi.fn().mockReturnValue({ eq: eqConn });

  // delete 메서드 — 호출 여부를 단언하기 위해 spy 로 노출
  const eqDelete = vi.fn().mockResolvedValue({ data: null, error: null });
  const deleteFn = vi.fn().mockReturnValue({ eq: eqDelete });

  const signOut = vi.fn().mockResolvedValue({ error: signOutError });

  const from = vi.fn().mockReturnValue({
    select: selectFn,
    delete: deleteFn,
  });

  return {
    from,
    deleteFn, // 호출 여부 단언용
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
    it('UNLINK — 세션 무효화 수행 + 매핑 행 삭제 안 함 + 2xx', async () => {
      const adminMock = makeAdminClient({ connData: { user_id: 'uid-001' } });
      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);

      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'UNLINK' },
        VALID_AUTH,
      ));

      expect(res.status).toBe(200);
      // 세션 무효화는 수행
      expect(adminMock.auth.admin.signOut).toHaveBeenCalledWith('uid-001', 'global');
      // 매핑 행(toss_connections) 삭제는 하지 않음 (재로그인 시 재사용)
      expect(adminMock.deleteFn).not.toHaveBeenCalled();
    });

    it('WITHDRAWAL_TERMS — 세션 무효화 수행 + 매핑 행 삭제 안 함 + 2xx', async () => {
      const adminMock = makeAdminClient({ connData: { user_id: 'uid-002' } });
      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);

      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'WITHDRAWAL_TERMS' },
        VALID_AUTH,
      ));

      expect(res.status).toBe(200);
      // 세션 무효화는 수행
      expect(adminMock.auth.admin.signOut).toHaveBeenCalled();
      // 매핑 행 삭제 없음 — 데이터 라이프사이클은 §1.1 D-CALLBACK 대기
      expect(adminMock.deleteFn).not.toHaveBeenCalled();
    });

    it('WITHDRAWAL_TOSS — 세션 무효화 수행 + 매핑 행 삭제 안 함 + 2xx', async () => {
      const adminMock = makeAdminClient({ connData: { user_id: 'uid-003' } });
      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);

      const res = await POST(makePostRequest(
        { userKey: 443731103, referrer: 'WITHDRAWAL_TOSS' },
        VALID_AUTH,
      ));

      expect(res.status).toBe(200);
      expect(adminMock.auth.admin.signOut).toHaveBeenCalled();
      expect(adminMock.deleteFn).not.toHaveBeenCalled();
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
