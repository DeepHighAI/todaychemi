import { createClient } from '@supabase/supabase-js';

// tsx auto-loads .env.local (--env-file 또는 자동)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const c = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // 0022: deduct_tokens, refund_tokens 두 함수 존재 확인
  const { data: fns, error: e1 } = await c
    .schema('information_schema' as never)
    .from('routines' as never)
    .select('routine_name')
    .in('routine_name', ['deduct_tokens', 'refund_tokens']);

  if (e1) {
    // Fallback: information_schema 접근 불가 시 RPC 직접 호출
    console.log('information_schema 직접 조회 불가, RPC 존재 여부로 대체 검증');
    const { error: deductErr } = await c.rpc('deduct_tokens' as never, {
      uid: '00000000-0000-0000-0000-000000000000',
      delta: 0,
      reason: 'verify',
      ref: 'verify',
    } as never);
    const { error: refundErr } = await c.rpc('refund_tokens' as never, {
      uid: '00000000-0000-0000-0000-000000000000',
      delta: 0,
      reason: 'verify',
      ref: 'verify',
    } as never);
    // 함수 자체가 존재하면 비즈니스 로직 에러는 나도 PGRST/HTTP 404는 없어야 함
    const deductExists = !deductErr || !/(does not exist|not found|404)/i.test(deductErr.message);
    const refundExists = !refundErr || !/(does not exist|not found|404)/i.test(refundErr.message);
    console.log(`[0022] deduct_tokens: ${deductExists ? '✅ 존재' : '❌ 없음'} (${deductErr?.message ?? 'no error'})`);
    console.log(`[0022] refund_tokens: ${refundExists ? '✅ 존재' : '❌ 없음'} (${refundErr?.message ?? 'no error'})`);
  } else {
    const names = (fns as Array<{ routine_name: string }>).map((r) => r.routine_name).sort();
    console.log(`[0022] 함수 발견: ${names.join(', ') || '(없음)'} — 기대: deduct_tokens, refund_tokens`);
  }

  // 0023: hapcard_replays_idempotency UNIQUE 제약 확인 — INSERT 시도로 검증
  // 잘못된 user_id 로 시도해도 제약 자체 존재 여부는 metadata 에서 확인 필요. RPC fallback.
  // 대신 hapcard_replays 테이블에 jinjin_date 컬럼이 있는지 select 가능한지로 확인
  const { error: e2 } = await c.from('hapcard_replays').select('jinjin_date').limit(0);
  console.log(`[0023] hapcard_replays.jinjin_date 컬럼: ${e2 ? `❌ ${e2.message}` : '✅ 존재'}`);
}

main().catch((e) => {
  console.error('verify failed:', e);
  process.exit(1);
});
