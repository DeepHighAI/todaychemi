/**
 * session.test.ts
 *
 * findOrCreateSupabaseUserForTossUserKey 단위 테스트.
 * 네트워크 없이 Supabase admin/anon mock 주입으로만 검증.
 * 실제 DB / cert / 비밀번호 불필요.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// 환경변수 설정 (모듈 import 전에 설정해야 함)
// ---------------------------------------------------------------------------

vi.stubEnv('TOSS_USER_PASSWORD_SECRET', 'test-secret-32-chars-long-enough!');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');

// ---------------------------------------------------------------------------
// 모듈 mock
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/service-role');
vi.mock('@supabase/supabase-js');

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createClient } from '@supabase/supabase-js';
import { findOrCreateSupabaseUserForTossUserKey } from '@/lib/toss/session';

const USER_KEY = 443731103;
const USER_ID = 'supabase-user-uuid-001';
const MOCK_EMAIL = `toss-${USER_KEY}@miniapp.todaychemi.local`;

// ---------------------------------------------------------------------------
// mock 팩토리
// ---------------------------------------------------------------------------

/**
 * 서비스 롤 클라이언트 mock 을 구성한다.
 *
 * @param existingConn  toss_connections 조회 결과 (null=없음)
 * @param insertError   INSERT 오류 (null=성공, { code:'23505' }=race 충돌)
 * @param createUserResult auth.admin.createUser 반환값
 */
function makeAdminClient(opts: {
  existingConn?: { user_id: string } | null;
  insertError?: { code: string; message?: string } | null;
  createUserError?: { message: string } | null;
  existingUserId?: string;
}) {
  const {
    existingConn = null,
    insertError = null,
    createUserError = null,
    existingUserId,
  } = opts;

  // from('toss_connections') mock
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existingConn,
    error: null,
  });
  const eqUserKey = vi.fn().mockReturnValue({ maybeSingle });
  const selectFn = vi.fn().mockReturnValue({ eq: eqUserKey });

  const insertResult = vi.fn().mockResolvedValue({
    data: null,
    error: insertError,
  });
  const insertFn = vi.fn().mockReturnValue(insertResult);

  const eqDelete = vi.fn().mockResolvedValue({ data: null, error: null });
  const deleteFn = vi.fn().mockReturnValue({ eq: eqDelete });

  const from = vi.fn().mockReturnValue({
    select: selectFn,
    insert: insertFn,
    delete: deleteFn,
  });

  // auth.admin mock
  const createUser = vi.fn().mockResolvedValue(
    createUserError
      ? { data: { user: null }, error: createUserError }
      : { data: { user: { id: USER_ID, email: MOCK_EMAIL } }, error: null },
  );

  const listUsers = vi.fn().mockResolvedValue({
    data: {
      users: existingUserId
        ? [{ id: existingUserId, email: MOCK_EMAIL }]
        : [],
    },
    error: null,
  });

  const signOut = vi.fn().mockResolvedValue({ error: null });

  return {
    from,
    auth: {
      admin: { createUser, listUsers, signOut },
    },
  };
}

/**
 * anon 클라이언트 mock (signInWithPassword)
 */
function makeAnonClient(opts: { signInError?: string | null } = {}) {
  const { signInError = null } = opts;

  const signInWithPassword = vi.fn().mockResolvedValue(
    signInError
      ? { data: { session: null }, error: { message: signInError } }
      : {
          data: {
            session: {
              access_token: 'supabase-access-token',
              refresh_token: 'supabase-refresh-token',
              expires_at: 1750000000,
              user: { id: USER_ID },
            },
          },
          error: null,
        },
  );

  return {
    auth: { signInWithPassword },
  };
}

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findOrCreateSupabaseUserForTossUserKey', () => {
  describe('기존 연결이 있는 경우 (find)', () => {
    it('toss_connections 에 매핑이 있으면 새 유저 생성 없이 세션을 민팅한다', async () => {
      const adminMock = makeAdminClient({ existingConn: { user_id: USER_ID } });
      const anonMock = makeAnonClient();

      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);
      vi.mocked(createClient).mockReturnValue(anonMock as never);

      const result = await findOrCreateSupabaseUserForTossUserKey(USER_KEY);

      // createUser 를 호출하지 않아야 함
      expect(adminMock.auth.admin.createUser).not.toHaveBeenCalled();
      // signInWithPassword 를 호출해야 함
      expect(anonMock.auth.signInWithPassword).toHaveBeenCalledWith({
        email: MOCK_EMAIL,
        password: expect.any(String) as string,
      });
      expect(result.access_token).toBe('supabase-access-token');
      expect(result.refresh_token).toBe('supabase-refresh-token');
      expect(result.user_id).toBe(USER_ID);
    });

    it('세션 반환값에 expires_at 이 포함된다', async () => {
      const adminMock = makeAdminClient({ existingConn: { user_id: USER_ID } });
      const anonMock = makeAnonClient();

      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);
      vi.mocked(createClient).mockReturnValue(anonMock as never);

      const result = await findOrCreateSupabaseUserForTossUserKey(USER_KEY);

      expect(result.expires_at).toBe(1750000000);
    });
  });

  describe('기존 연결이 없는 경우 (create)', () => {
    it('toss_connections 없으면 유저를 생성하고 연결을 삽입한 뒤 세션을 민팅한다', async () => {
      const adminMock = makeAdminClient({ existingConn: null });
      const anonMock = makeAnonClient();

      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);
      vi.mocked(createClient).mockReturnValue(anonMock as never);

      const result = await findOrCreateSupabaseUserForTossUserKey(USER_KEY);

      expect(adminMock.auth.admin.createUser).toHaveBeenCalledWith({
        email: MOCK_EMAIL,
        password: expect.any(String) as string,
        email_confirm: true,
      });
      expect(adminMock.from).toHaveBeenCalledWith('toss_connections');
      expect(result.access_token).toBe('supabase-access-token');
      expect(result.user_id).toBe(USER_ID);
    });

    it('결정형 비밀번호는 동일 userKey 에 대해 항상 동일하다', async () => {
      const capturedPasswords: string[] = [];

      const adminMock1 = makeAdminClient({ existingConn: null });
      const anonMock1 = makeAnonClient();
      const originalSignIn1 = anonMock1.auth.signInWithPassword;
      anonMock1.auth.signInWithPassword = vi.fn().mockImplementation(
        async (params: { email: string; password: string }) => {
          capturedPasswords.push(params.password);
          return originalSignIn1(params);
        },
      );

      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock1 as never);
      vi.mocked(createClient).mockReturnValue(anonMock1 as never);
      await findOrCreateSupabaseUserForTossUserKey(USER_KEY);

      vi.clearAllMocks();

      // 두 번째 호출 (기존 연결 있는 것처럼)
      const adminMock2 = makeAdminClient({ existingConn: { user_id: USER_ID } });
      const anonMock2 = makeAnonClient();
      const originalSignIn2 = anonMock2.auth.signInWithPassword;
      anonMock2.auth.signInWithPassword = vi.fn().mockImplementation(
        async (params: { email: string; password: string }) => {
          capturedPasswords.push(params.password);
          return originalSignIn2(params);
        },
      );

      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock2 as never);
      vi.mocked(createClient).mockReturnValue(anonMock2 as never);
      await findOrCreateSupabaseUserForTossUserKey(USER_KEY);

      expect(capturedPasswords).toHaveLength(2);
      expect(capturedPasswords[0]).toBe(capturedPasswords[1]);
    });
  });

  describe('UNIQUE 충돌 race 처리 (23505)', () => {
    it('INSERT 시 23505 충돌은 기존 연결로 간주하고 세션을 민팅한다', async () => {
      const adminMock = makeAdminClient({
        existingConn: null,
        insertError: { code: '23505', message: 'duplicate key' },
      });
      const anonMock = makeAnonClient();

      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);
      vi.mocked(createClient).mockReturnValue(anonMock as never);

      // 23505 에도 오류 없이 세션 반환되어야 함
      const result = await findOrCreateSupabaseUserForTossUserKey(USER_KEY);

      expect(result.access_token).toBe('supabase-access-token');
    });

    it('createUser 가 "already registered" 오류를 반환하면 listUsers 로 재조회한다', async () => {
      const EXISTING_USER_ID = 'existing-user-uuid-from-race';
      const adminMock = makeAdminClient({
        existingConn: null,
        createUserError: { message: 'User already registered' },
        existingUserId: EXISTING_USER_ID,
      });
      const anonMock = makeAnonClient();

      vi.mocked(createServiceRoleClient).mockReturnValue(adminMock as never);
      vi.mocked(createClient).mockReturnValue(anonMock as never);

      const result = await findOrCreateSupabaseUserForTossUserKey(USER_KEY);

      expect(adminMock.auth.admin.listUsers).toHaveBeenCalled();
      // listUsers 로 찾은 user_id 로 INSERT 됨 → 세션 민팅 성공
      expect(result.access_token).toBe('supabase-access-token');
    });
  });
});
