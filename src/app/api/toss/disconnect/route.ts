/**
 * /api/toss/disconnect
 *
 * Apps-in-Toss 사용자 발화 disconnect 콜백 (§2.7).
 * Toss 가 사용자 연결 해제 또는 탈퇴 시 이 엔드포인트를 호출한다.
 *
 * 지원 HTTP 메서드: GET (쿼리파라미터) + POST (JSON 바디) — 콘솔 설정에 따름.
 *
 * 인증: Basic Auth 헤더 검증.
 *   Authorization: Basic base64(user:pass)
 *   환경변수 TOSS_DISCONNECT_BASIC_AUTH = "user:pass" 형식.
 *
 * 의무 처리:
 *   - userKey 에 대응하는 Supabase 세션 무효화(auth.admin.signOut)
 *   - 멱등(이미 연결 없어도 2xx 반환)
 *
 * referrer 별 데이터 라이프사이클 (§1.1 D-CALLBACK 사용자 확정 2026-06-15):
 *   - UNLINK: 세션 무효화만 + 데이터/매핑 보존 (재로그인 시 이어쓰기).
 *   - WITHDRAWAL_TERMS: 세션 무효화만 + 데이터/매핑 보존 (재로그인 시 약관 재동의는
 *     토스 로그인 흐름에서 재노출). 서버 처리는 UNLINK 와 동일.
 *   - WITHDRAWAL_TOSS: 토스 회원 탈퇴 = 인앱 계정삭제 정책과 동일하게
 *     users.deletion_requested_at 설정 → 30일 grace 후 purge_deleted_users cron 이
 *     auth.users 삭제(cascade 로 toss_connections·소유 데이터 일괄 삭제, 0020_deletion_grace).
 *
 * ⚠️ PII / userKey 로깅 금지 (CLAUDE.md §5).
 *
 * 출처: 구현 레퍼런스 §2.7, §3.4(inbound IP)
 */

export const runtime = 'nodejs';

import { z } from 'zod';
import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';

// ---------------------------------------------------------------------------
// 요청 스키마
// ---------------------------------------------------------------------------

const DisconnectPayloadSchema = z.object({
  userKey: z.number().int().positive(),
  /**
   * 연결 해제 사유.
   * UNLINK: 사용자 직접 연결 끊기.
   * WITHDRAWAL_TERMS: 로그인 서비스 약관 동의 철회.
   * WITHDRAWAL_TOSS: 토스 회원 탈퇴.
   */
  referrer: z.enum(['UNLINK', 'WITHDRAWAL_TERMS', 'WITHDRAWAL_TOSS']),
});

type DisconnectPayload = z.infer<typeof DisconnectPayloadSchema>;

// ---------------------------------------------------------------------------
// 인증 헬퍼
// ---------------------------------------------------------------------------

/**
 * Basic Auth 헤더를 검증한다.
 *
 * 환경변수 TOSS_DISCONNECT_BASIC_AUTH = "username:password" 형식.
 * 불일치 시 false 반환 — 호출자가 401 반환 책임.
 */
function verifyBasicAuth(authHeader: string | null): boolean {
  const expected = process.env.TOSS_DISCONNECT_BASIC_AUTH;
  if (!expected || !authHeader) return false;

  // "Basic <base64>" 형식 파싱
  const match = authHeader.match(/^Basic\s+(.+)$/i);
  if (!match) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf-8');
  } catch {
    return false;
  }

  // 타이밍 안전 비교 — timingSafeEqual 을 쓰기 위해 Buffer 로 변환
  const { timingSafeEqual } = require('node:crypto') as typeof import('node:crypto');
  try {
    const a = Buffer.from(decoded);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 처리 핵심 로직 (GET / POST 공통)
// ---------------------------------------------------------------------------

/**
 * 토스 회원 탈퇴(WITHDRAWAL_TOSS) 시 인앱 계정삭제 정책과 동일하게
 * users.deletion_requested_at 을 설정한다(30일 grace 후 purge cron 이 cascade 삭제).
 *
 * 멱등: 프로필이 없거나(미온보딩) 이미 삭제 요청된 경우 noop.
 * 실패는 경고 로그만 — disconnect 콜백은 멱등 2xx 를 유지해야 하므로 throw 하지 않는다.
 */
async function markUserForDeletion(
  admin: ReturnType<typeof createServiceRoleClient>,
  userId: string,
): Promise<void> {
  const { data: profile, error: selectErr } = await admin
    .from('users')
    .select('deletion_requested_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (selectErr) {
    console.error('[toss/disconnect] users 조회 실패 (삭제 마킹 생략):', selectErr.message);
    return;
  }
  // 미온보딩(프로필 없음) 또는 이미 삭제 요청됨 → 멱등 noop
  if (!profile || profile.deletion_requested_at) return;

  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from('users')
    .update({ deletion_requested_at: now, updated_at: now })
    .eq('user_id', userId);

  if (updateErr) {
    console.error('[toss/disconnect] deletion_requested_at 설정 실패:', updateErr.message);
  }
}

/**
 * userKey 에 대응하는 Supabase 유저를 referrer 정책에 따라 처리한다.
 *
 * 처리 순서:
 *   1. toss_connections 에서 user_id 조회 (없으면 멱등 성공)
 *   2. auth.admin.signOut(userId, 'global') — 모든 referrer 공통(세션 무효화)
 *   3. referrer 분기:
 *        - WITHDRAWAL_TOSS → markUserForDeletion (30일 grace 삭제 예약)
 *        - UNLINK / WITHDRAWAL_TERMS → 추가 처리 없음(데이터·매핑 보존)
 *
 * ⚠️ toss_connections 매핑 행은 직접 삭제하지 않는다.
 *   UNLINK / WITHDRAWAL_TERMS = 재로그인 시 매핑 재사용.
 *   WITHDRAWAL_TOSS = purge cron 의 auth.users 삭제가 on-delete-cascade 로 매핑까지 제거.
 *
 * 멱등: toss_connections 행이 없으면 조용히 성공 처리.
 */
async function handleDisconnect(payload: DisconnectPayload): Promise<void> {
  const { userKey, referrer } = payload;
  const admin = createServiceRoleClient();

  // ── 1. toss_connections 에서 user_id 조회 ────────────────────────────────
  const { data: conn, error: connErr } = await admin
    .from('toss_connections')
    .select('user_id')
    .eq('toss_user_key', userKey)
    .maybeSingle();

  if (connErr) {
    // 조회 실패는 서버 오류 — 멱등 요구사항상 2xx 반환이지만 로그는 남김
    console.error('[toss/disconnect] toss_connections 조회 실패:', connErr.message);
    return;
  }

  if (!conn) {
    // 이미 연결이 없음 — 멱등, 조용히 성공
    return;
  }

  const userId = conn.user_id;

  // ── 2. Supabase 세션 무효화 (모든 referrer 공통) ─────────────────────────
  // referrer 를 로깅하되 PII 포함 없음(§5).
  // 'global' scope: 해당 유저의 모든 세션 토큰을 일괄 무효화한다.
  console.info('[toss/disconnect] 세션 무효화 시작, referrer:', referrer);
  const { error: signOutErr } = await admin.auth.admin.signOut(userId, 'global');
  if (signOutErr) {
    // 세션 무효화 실패는 경고 — 멱등이므로 계속 진행(이미 만료된 세션 등)
    console.error('[toss/disconnect] signOut 실패 (계속 진행):', signOutErr.message);
  }

  // ── 3. referrer 별 데이터 라이프사이클 ───────────────────────────────────
  // WITHDRAWAL_TOSS = 토스 회원 탈퇴 → 인앱 계정삭제 정책(30일 grace) 동일 적용.
  // UNLINK / WITHDRAWAL_TERMS = 데이터·매핑 보존(세션 무효화만).
  if (referrer === 'WITHDRAWAL_TOSS') {
    await markUserForDeletion(admin, userId);
  }
}

// ---------------------------------------------------------------------------
// 공통 응답
// ---------------------------------------------------------------------------

function okResponse() {
  return NextResponse.json({ ok: true });
}

function unauthorizedResponse() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

function badRequestResponse(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/toss/disconnect?userKey=...&referrer=...
 * Toss 콘솔에 GET 으로 설정한 경우.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!verifyBasicAuth(authHeader)) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const raw = {
    userKey: Number(searchParams.get('userKey')),
    referrer: searchParams.get('referrer'),
  };

  const parsed = DisconnectPayloadSchema.safeParse(raw);
  if (!parsed.success) return badRequestResponse('userKey 와 referrer 가 필요합니다');

  await handleDisconnect(parsed.data);
  return okResponse();
}

/**
 * POST /api/toss/disconnect
 * Toss 콘솔에 POST 로 설정한 경우.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!verifyBasicAuth(authHeader)) return unauthorizedResponse();

  const json = await request.json().catch(() => null);
  const parsed = DisconnectPayloadSchema.safeParse(json);
  if (!parsed.success) return badRequestResponse('userKey 와 referrer 가 필요합니다');

  await handleDisconnect(parsed.data);
  return okResponse();
}
