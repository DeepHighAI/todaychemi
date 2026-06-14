/**
 * session.ts
 *
 * Apps-in-Toss Auth Bridge Option A — Supabase 세션 민팅.
 *
 * 흐름:
 *   1. `toss_connections` 테이블에서 toss_user_key 로 기존 연결을 조회한다.
 *   2. 연결이 있으면 해당 user_id 의 이메일/비밀번호로 Supabase 세션을 민팅.
 *   3. 연결이 없으면:
 *      a. `auth.admin.createUser` 로 유령 계정(ghost account)을 생성한다.
 *         - email: `toss-{userKey}@miniapp.todaychemi.local` (실제 이메일 아님)
 *         - password: HMAC-SHA256(userKey, TOSS_USER_PASSWORD_SECRET) hex
 *      b. `toss_connections` 에 매핑 row 를 INSERT.
 *      c. `signInWithPassword` 로 세션 민팅.
 *   4. UNIQUE 충돌(동시 요청 race)은 재조회 → 세션 민팅으로 처리.
 *
 * ⚠️ 이 모듈은 서버 런타임(Route Handler)에서만 호출.
 *    브라우저 번들에 포함 금지 — TOSS_USER_PASSWORD_SECRET 노출 위험.
 *
 * 비밀번호 결정형 설계 메모:
 *   password = HMAC-SHA256(userKey.toString(), TOSS_USER_PASSWORD_SECRET).hex
 *   서버가 언제든 재파생할 수 있어 DB 저장이 불필요하다.
 *   `signInWithPassword` 는 서버 측 anon 클라이언트로 호출하므로
 *   실제 refreshToken 발급까지 완전한 세션 페어가 반환된다.
 *   클라이언트(미니앱)는 이 토큰을 Bearer 로 사용하고 서버는 JWT 를 검증한다.
 *
 * 출처: 구현 레퍼런스 §7.1(auth surface), §7.2(세션 민팅)
 */

import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getSupabasePublicConfig } from '@/lib/supabase/env';

// ---------------------------------------------------------------------------
// 반환 타입
// ---------------------------------------------------------------------------

export interface TossSupabaseSession {
  /** Supabase JWT access token — 미니앱이 Bearer 로 사용 */
  access_token: string;
  /** Supabase refresh token — 만료 전 갱신에 사용 */
  refresh_token: string;
  /** 만료 Unix timestamp(초) */
  expires_at: number;
  /** Supabase auth.users.id */
  user_id: string;
}

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

/**
 * userKey 와 TOSS_USER_PASSWORD_SECRET 으로 결정형 비밀번호를 파생한다.
 *
 * HMAC-SHA256(message=userKey.toString(), key=secret) → hex string.
 * 동일 userKey + secret 조합은 항상 동일 비밀번호를 산출하므로
 * DB 저장 없이 필요할 때마다 재파생할 수 있다.
 */
function derivePassword(userKey: number): string {
  const secret = process.env.TOSS_USER_PASSWORD_SECRET;
  if (!secret) {
    throw new Error('TOSS_USER_PASSWORD_SECRET 환경변수가 설정되지 않았습니다');
  }
  return createHmac('sha256', secret).update(userKey.toString()).digest('hex');
}

/**
 * userKey 에 대응하는 유령 계정 이메일 주소를 생성한다.
 * `.local` 도메인이므로 실제 이메일 전송 경로가 없다.
 */
function deriveEmail(userKey: number): string {
  return `toss-${userKey}@miniapp.todaychemi.local`;
}

/**
 * anon 클라이언트로 Supabase 세션(access_token + refresh_token)을 민팅한다.
 * signInWithPassword 는 RLS 를 거치지 않으므로 서비스 롤 불필요.
 */
async function mintSession(email: string, password: string): Promise<TossSupabaseSession> {
  const { url, anonKey } = getSupabasePublicConfig();
  // 서버 전용 anon 클라이언트 — 쿠키/세션 미영속, 1회성 토큰 발급 목적
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await anon.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw new Error(
      `Supabase signInWithPassword 실패: ${error?.message ?? 'session null'}`,
    );
  }

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    user_id: data.session.user.id,
  };
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/**
 * Toss userKey 에 대응하는 Supabase 세션을 찾거나 새로 생성한다.
 *
 * @param userKey  login-me 응답의 `userKey` (앱 스코프 숫자 식별자)
 * @returns        미니앱 Bearer 세션 { access_token, refresh_token, expires_at, user_id }
 *
 * @throws         환경변수 누락 / Supabase admin API 오류 / signInWithPassword 실패
 */
export async function findOrCreateSupabaseUserForTossUserKey(
  userKey: number,
): Promise<TossSupabaseSession> {
  const admin = createServiceRoleClient();
  const email = deriveEmail(userKey);
  const password = derivePassword(userKey);

  // ── 1. toss_connections 에서 기존 매핑 조회 ──────────────────────────────
  const { data: existingConn, error: connErr } = await admin
    .from('toss_connections')
    .select('user_id')
    .eq('toss_user_key', userKey)
    .maybeSingle();

  if (connErr) {
    throw new Error(`toss_connections 조회 오류: ${connErr.message}`);
  }

  if (existingConn) {
    // ── 2. 기존 연결 있음 → 세션 민팅 후 반환 ────────────────────────────
    return mintSession(email, password);
  }

  // ── 3. 기존 연결 없음 → 유령 계정 생성 + 연결 INSERT ───────────────────
  const { data: createData, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // 이메일 검증 없이 즉시 활성화
  });

  let userId: string;

  if (createErr) {
    // 3-a. 이미 존재하는 이메일 — 동시 요청 race 또는 이전 생성 흔적
    //      Supabase 는 중복 이메일에 "User already registered" 를 반환한다.
    if (
      createErr.message?.toLowerCase().includes('already registered') ||
      createErr.message?.toLowerCase().includes('already exists')
    ) {
      // 기존 유저를 이메일로 재조회
      const { data: { users }, error: listErr } =
        await admin.auth.admin.listUsers();
      if (listErr) throw new Error(`admin.listUsers 오류: ${listErr.message}`);

      const found = users.find((u) => u.email === email);
      if (!found) {
        throw new Error(
          `유령 계정 생성 race: 이메일(${email}) 조회 실패`,
        );
      }
      userId = found.id;
    } else {
      throw new Error(`auth.admin.createUser 오류: ${createErr.message}`);
    }
  } else {
    if (!createData.user) {
      throw new Error('auth.admin.createUser 응답에 user 가 없습니다');
    }
    userId = createData.user.id;
  }

  // ── 4. toss_connections INSERT (UNIQUE 충돌 = race, 무시 후 계속) ────────
  const { error: insertErr } = await admin
    .from('toss_connections')
    .insert({ toss_user_key: userKey, user_id: userId });

  if (insertErr) {
    // 23505 = unique_violation → 동시 INSERT race, 이미 연결 존재 → 진행
    if ((insertErr as { code?: string }).code !== '23505') {
      throw new Error(`toss_connections INSERT 오류: ${insertErr.message}`);
    }
    // race 충돌 — 이미 삽입된 것 그대로 사용, 세션 민팅으로 이어짐
  }

  // ── 5. 세션 민팅 ─────────────────────────────────────────────────────────
  return mintSession(email, password);
}
