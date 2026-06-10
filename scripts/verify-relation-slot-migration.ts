import { createClient } from '@supabase/supabase-js';

// 20260610000000_relation_slot_registration.sql 라이브 적용 검증.
// 사용: pnpm tsx scripts/verify-relation-slot-migration.ts
// - 테이블/컬럼 존재
// - payments CHECK 가 'relation_slot' 허용 (INSERT→DELETE 왕복)
// - deduct/refund_tokens_once IN-list + 부분 유니크 인덱스 확장
//   (같은 ref 2회 호출 시 inserted=false 가 유일한 판별식 — 미확장이면 2회 모두 insert 됨)
// - anon 쓰기 차단 smoke (SELECT-only RLS)
// 토큰 원장은 +1/-1 net 0 후 검증 행을 삭제해 흔적을 남기지 않는다.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const c = createClient(url, key, { auth: { persistSession: false } });

let failed = 0;
function report(label: string, ok: boolean, detail = '') {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed += 1;
}

function tokenRpcInserted(data: unknown): boolean {
  return Boolean(data && typeof data === 'object' && (data as { inserted?: unknown }).inserted === true);
}

async function main() {
  const runId = Date.now().toString(36);

  // 1. 테이블 + 전체 컬럼 조회 가능
  const { error: tableErr } = await c
    .from('pending_relation_registrations')
    .select('pending_id, user_id, draft, relation_id, materialized_at, created_at')
    .limit(0);
  report('pending_relation_registrations 테이블/컬럼', !tableErr, tableErr?.message ?? '');

  // 2. 검증용 실제 user_id (FK 충족용 — 어떤 유저든 무방, 원장은 net 0 후 정리)
  const { data: users, error: userErr } = await c.from('users').select('user_id').limit(1);
  const uid = (users as Array<{ user_id: string }> | null)?.[0]?.user_id;
  if (userErr || !uid) {
    report('검증용 user_id 확보', false, userErr?.message ?? 'users 테이블 비어 있음');
    process.exit(1);
  }

  // 3. payments CHECK 에 relation_slot 허용 — INSERT→DELETE 왕복
  const orderId = `verify_relslot_${runId}`;
  const { data: payRows, error: payErr } = await c
    .from('payments')
    .insert({
      user_id: uid,
      toss_order_id: orderId,
      amount_krw: 1000,
      token_amount: null,
      product_id: null,
      charge_type: 'feature_use',
      feature_id: 'relation_slot',
      feature_ref: `relation_slot:verify-${runId}`,
      status: 'pending',
    })
    .select('payment_id');
  report(
    "payments CHECK 'relation_slot' 허용",
    !payErr,
    payErr ? `${payErr.code}: ${payErr.message}` : '',
  );
  const paymentId = (payRows as Array<{ payment_id: string }> | null)?.[0]?.payment_id;
  if (paymentId) {
    await c.from('payments').delete().eq('payment_id', paymentId);
  }

  // 4. refund_tokens_once — relation_slot_refund 멱등 (IN-list + 인덱스 predicate)
  const refundRef = `verify:relation_slot:refund:${runId}`;
  const r1 = await c.rpc('refund_tokens_once', {
    uid,
    delta: 1,
    reason: 'relation_slot_refund',
    ref: refundRef,
  });
  const r2 = await c.rpc('refund_tokens_once', {
    uid,
    delta: 1,
    reason: 'relation_slot_refund',
    ref: refundRef,
  });
  report(
    'refund_tokens_once relation_slot_refund 1회차 insert',
    !r1.error && tokenRpcInserted(r1.data),
    r1.error?.message ?? JSON.stringify(r1.data),
  );
  report(
    'refund_tokens_once relation_slot_refund 2회차 멱등(inserted=false)',
    !r2.error && !tokenRpcInserted(r2.data),
    r2.error?.message ?? JSON.stringify(r2.data),
  );

  // 5. deduct_tokens_once — relation_slot_use 멱등 (위 +1 덕에 잔액 보장)
  const useRef = `verify:relation_slot:use:${runId}`;
  const d1 = await c.rpc('deduct_tokens_once', {
    uid,
    delta: -1,
    reason: 'relation_slot_use',
    ref: useRef,
  });
  const d2 = await c.rpc('deduct_tokens_once', {
    uid,
    delta: -1,
    reason: 'relation_slot_use',
    ref: useRef,
  });
  report(
    'deduct_tokens_once relation_slot_use 1회차 insert',
    !d1.error && tokenRpcInserted(d1.data),
    d1.error?.message ?? JSON.stringify(d1.data),
  );
  report(
    'deduct_tokens_once relation_slot_use 2회차 멱등(inserted=false)',
    !d2.error && !tokenRpcInserted(d2.data),
    d2.error?.message ?? JSON.stringify(d2.data),
  );

  // 6. 검증 원장 행 정리 (+1/-1 = net 0 이라 삭제해도 잔액 합계 불변)
  const { error: cleanupErr } = await c
    .from('token_ledger')
    .delete()
    .eq('user_id', uid)
    .in('reference_id', [refundRef, useRef]);
  report('검증 원장 행 정리', !cleanupErr, cleanupErr?.message ?? '');

  // 7. anon 쓰기 차단 smoke (SELECT-only RLS — 쓰기는 service-role 전용)
  if (anonKey) {
    const anon = createClient(url!, anonKey, { auth: { persistSession: false } });
    const { error: anonInsertErr } = await anon
      .from('pending_relation_registrations')
      .insert({ user_id: uid, draft: {} });
    report(
      'anon INSERT 차단 (RLS)',
      Boolean(anonInsertErr),
      anonInsertErr ? `차단됨: ${anonInsertErr.code}` : '⚠️ INSERT 가 통과해버림',
    );
  } else {
    console.log('[SKIP] anon 키 없음 — RLS smoke 생략');
  }

  console.log('');
  if (failed > 0) {
    console.error(`relation_slot migration verify FAIL (${failed})`);
    process.exit(1);
  }
  console.log('relation_slot migration verify PASS');
}

main().catch((e) => {
  console.error('verify failed:', e);
  process.exit(1);
});
