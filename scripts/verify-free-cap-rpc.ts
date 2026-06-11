import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

// 20260610140000_free_relation_cap_rpc.sql 라이브 적용 검증.
// 사용: pnpm tsx --env-file=.env.local scripts/verify-free-cap-rpc.ts
// 모든 프로브는 쓰기 흔적 0 (cap=0 단락 / FK 실패 / 권한 거부) — 라이브 데이터 불변.

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

// RelationCreate 형태의 well-formed draft — jsonb 캐스트 경로까지 실행됨을 보장
const DRAFT = {
  nickname: '검증용',
  mode: '친구합',
  gender: 'F',
  birth_date: '1995-05-05',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'unknown',
  birth_time: '',
  consent_confirmed: true,
  is_primary: false,
};

async function main() {
  // 1. 함수 존재 + cap 단락 로직 — 실제 user + p_free_slots=0 → count<0 은 항상 false → null 반환, INSERT 미발생
  const { data: users, error: userErr } = await c.from('users').select('user_id').limit(1);
  const uid = (users as Array<{ user_id: string }> | null)?.[0]?.user_id;
  if (userErr || !uid) {
    report('검증용 user_id 확보', false, userErr?.message ?? 'users 테이블 비어 있음');
    process.exit(1);
  }
  const capProbe = await c.rpc('insert_relation_if_under_free_cap', {
    p_user_id: uid,
    p_draft: DRAFT,
    p_free_slots: 0,
  });
  report(
    'RPC 존재 + cap=0 단락(null 반환, INSERT 없음)',
    !capProbe.error && capProbe.data === null,
    capProbe.error ? `${capProbe.error.code}: ${capProbe.error.message}` : `data=${JSON.stringify(capProbe.data)}`,
  );

  // 2. INSERT...SELECT 배선 — 존재하지 않는 uuid → count=0 < 2 통과 → INSERT 시도 → users FK 23503 실패 (행 미생성)
  const fkProbe = await c.rpc('insert_relation_if_under_free_cap', {
    p_user_id: randomUUID(),
    p_draft: DRAFT,
    p_free_slots: 2,
  });
  report(
    'INSERT 경로 실행(jsonb 캐스트 통과 → FK 23503 기대)',
    fkProbe.error?.code === '23503',
    fkProbe.error ? `${fkProbe.error.code}: ${fkProbe.error.message}` : `에러 없이 통과 — data=${JSON.stringify(fkProbe.data)}`,
  );

  // 3. 권한 — anon 은 execute revoke 상태여야 함 (service_role 전용)
  if (anonKey) {
    const anon = createClient(url!, anonKey, { auth: { persistSession: false } });
    const anonProbe = await anon.rpc('insert_relation_if_under_free_cap', {
      p_user_id: uid,
      p_draft: DRAFT,
      p_free_slots: 0,
    });
    report(
      'anon execute 차단(권한 거부)',
      Boolean(anonProbe.error),
      anonProbe.error ? `차단됨: ${anonProbe.error.code}` : '⚠️ anon 호출이 통과해버림',
    );
  } else {
    console.log('[SKIP] anon 키 없음 — 권한 smoke 생략');
  }

  console.log('');
  if (failed > 0) {
    console.error(`free-cap RPC verify FAIL (${failed})`);
    process.exit(1);
  }
  console.log('free-cap RPC verify PASS');
}

main().catch((e) => {
  console.error('verify failed:', e);
  process.exit(1);
});
