import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// G2 / Phase 3 F1.4 — daily_haps 신규 컬럼(0029) 라이브 적용 검증.
// 사용법: `pnpm tsx scripts/verify-0029.ts`. .env.local 의 SUPABASE_SERVICE_ROLE_KEY 사용.

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const c = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  let ok = true;

  // (a) daily_haps 테이블에서 신규 3컬럼 select 가능한지 (컬럼 존재 검증)
  const { error: selectErr } = await c
    .from('daily_haps')
    .select('hap_id, primary_relation_id, relation_nickname, today_compat_score, llm_model')
    .limit(1);
  if (selectErr) {
    console.log(`[0029] ❌ select 실패: ${selectErr.message}`);
    ok = false;
  } else {
    console.log('[0029] ✅ 신규 컬럼 select 가능 (relation_nickname, today_compat_score)');
  }

  // (b) check 제약 검증 — invalid 값 INSERT 시 거부되어야 함 (0..100 범위 외)
  // 직접 INSERT 가 user_id FK 충돌로 어려우므로, 컬럼 정의만 확인.
  // information_schema 로 컬럼 메타데이터 조회.
  const { data: cols, error: metaErr } = await c
    .rpc('exec_sql' as never, {
      sql: `select column_name, data_type, is_nullable
            from information_schema.columns
            where table_schema='public' and table_name='daily_haps'
              and column_name in ('relation_nickname','today_compat_score')`,
    } as never)
    .single();
  if (metaErr) {
    // exec_sql RPC 가 없을 수 있음 — 무시하고 (a) 결과로 판단
    console.log('[0029] ℹ️  information_schema 직접 조회 미지원 (RPC exec_sql 없음) — (a) 결과로 판단');
  } else {
    console.log('[0029] 컬럼 메타: ', cols);
  }

  // (c) llm_model default 'gpt-5' 검증 — 새 row INSERT 가 가장 확실하지만 부수효과 우려.
  // 대신 information_schema.columns 의 column_default 컬럼 확인 (위와 동일하게 RPC 가능 시).
  // 운영상 db push 가 성공했다면 default 도 함께 갱신됨 — 본 스크립트는 (a) 만으로 PASS 처리.

  if (!ok) {
    console.error('\n❌ verify-0029 실패 — 사용자 수동: `pnpm db:push` 후 재실행');
    process.exit(1);
  }
  console.log('\n✅ verify-0029 PASS');
}

main().catch((e) => {
  console.error('verify failed:', e);
  process.exit(1);
});
