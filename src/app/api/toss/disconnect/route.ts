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
 * // TODO(§1.1 D-CALLBACK): referrer 별 데이터 라이프사이클 결정 대기.
 *   - UNLINK: 세션 무효화만(현재 구현)
 *   - WITHDRAWAL_TERMS: 약관 철회 후처리 (법무 결정 필요)
 *   - WITHDRAWAL_TOSS: 토스 탈퇴 후처리 (법무 결정 필요)
 *   현재 구현은 모든 referrer 에 대해 세션 무효화만 수행하고 데이터는 보존한다.
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
 * userKey 에 대응하는 Supabase 유저의 세션을 무효화한다.
 *
 * 1. toss_connections 에서 user_id 조회
 * 2. auth.admin.signOut(userId, 'global') 호출
 * 3. toss_connections 행 삭제 (연결 해제 완료)
 *
 * 멱등: toss_connections 행이 없으면 조용히 성공 처리.
 */
async function handleDisconnect(payload: DisconnectPayload): Promise<void> {
  const { userKey } = payload;
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

  // ── 2. Supabase 세션 무효화 ──────────────────────────────────────────────
  // 'global' scope: 해당 유저의 모든 세션 토큰을 일괄 무효화한다.
  const { error: signOutErr } = await admin.auth.admin.signOut(userId, 'global');
  if (signOutErr) {
    // 세션 무효화 실패는 경고 — 연결 행 삭제는 계속 진행
    console.error('[toss/disconnect] signOut 실패 (계속 진행):', signOutErr.message);
  }

  // ── 3. toss_connections 행 삭제 ──────────────────────────────────────────
  // TODO(§1.1 D-CALLBACK): WITHDRAWAL_TOSS / WITHDRAWAL_TERMS 시
  //   user-owned relations / hapcards / user_charts 의 hard-delete vs soft-disable 결정 필요.
  //   현재 구현: 세션 무효화 + toss_connections 삭제만 수행하고 데이터는 보존.
  const { error: deleteErr } = await admin
    .from('toss_connections')
    .delete()
    .eq('toss_user_key', userKey);

  if (deleteErr) {
    console.error('[toss/disconnect] toss_connections 삭제 실패:', deleteErr.message);
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
