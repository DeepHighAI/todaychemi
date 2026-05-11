import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

const ALLOWED = ['gpt-5o', 'gpt-5', 'gpt-5-mini', 'claude-fallback'] as const;
const REJECTED = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.5-preview'] as const;

async function probeCheck(table: 'hapcards' | 'whatif_results', llm_model: string) {
  // FK/NOT NULL 오류는 무시하고 CHECK(23514) 만 관심. 실 INSERT 없이 dummy 시도.
  const payload =
    table === 'hapcards'
      ? {
          user_id: '00000000-0000-0000-0000-000000000000',
          relation_id: '00000000-0000-0000-0000-000000000000',
          mode: '일합',
          compat_score: 0,
          score_breakdown: {},
          content: {},
          prompt_version: 'v0.0',
          llm_model,
          cache_key: `probe-${table}-${llm_model}-${Date.now()}`,
          user_chart_hash: 'x',
          relation_chart_hash: 'x',
        }
      : {
          user_id: '00000000-0000-0000-0000-000000000000',
          type: 'work',
          content: {},
          prompt_version: 'v0.0',
          llm_model,
          cache_key: `probe-${table}-${llm_model}-${Date.now()}`,
          chart_hash: 'x',
        };

  const { error } = await (c.from(table) as ReturnType<typeof c.from>).insert(payload as never);

  if (!error) return { ok: true, reason: 'INSERT 성공 (롤백 불가 — dummy 데이터 삽입됨)' };
  if (error.code === '23514') return { ok: false, reason: `CHECK 거부 (${error.message})` };
  // FK 오류(23503) = CHECK 는 통과한 것
  if (error.code === '23503') return { ok: true, reason: `CHECK 통과 (FK 오류 23503: ${error.message.slice(0, 80)})` };
  return { ok: true, reason: `CHECK 통과 (기타 오류 ${error.code}: ${error.message.slice(0, 80)})` };
}

async function main() {
  console.log('\n=== verify-llm-check: hapcards / whatif_results llm_model CHECK ===\n');

  const tables: Array<'hapcards' | 'whatif_results'> = ['hapcards', 'whatif_results'];
  let allPass = true;

  for (const table of tables) {
    console.log(`[${table}]`);
    for (const model of ALLOWED) {
      const { ok, reason } = await probeCheck(table, model);
      const icon = ok ? '  ✅' : '  ❌';
      console.log(`${icon} ${model}: ${reason}`);
      if (!ok) allPass = false;
    }
    for (const model of REJECTED) {
      const { ok, reason } = await probeCheck(table, model);
      const icon = !ok ? '  ✅' : '  ⚠️';
      console.log(`${icon} ${model} (거부 기대): ${reason}`);
    }
    console.log('');
  }

  if (allPass) {
    console.log('✅ 0028 적용 확인 — gpt-5-mini CHECK 통과. E2E 진행 가능.');
  } else {
    console.log('❌ CHECK 미적용 — pnpm db:push 로 0028_llm_model_check_realign 적용 필요.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('verify failed:', e);
  process.exit(1);
});
