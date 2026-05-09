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

async function main() {
  // (a) 0024+seed: v0.3 active 6행
  const { data: actives, error: e1 } = await c
    .from('prompt_versions')
    .select('prompt_name, version, status')
    .eq('status', 'active')
    .eq('version', 'v0.3');
  if (e1) console.log(`[0024+seed] error: ${e1.message}`);
  console.log(`[0024+seed] v0.3 active: ${actives?.length ?? 0}/6`);
  if (actives?.length) {
    for (const row of actives) {
      console.log(`  - ${row.prompt_name} (${row.version} ${row.status})`);
    }
  }

  // (b) 0024: v0.2 rolled_back
  const { data: rolled, error: e3 } = await c
    .from('prompt_versions')
    .select('prompt_name')
    .eq('status', 'rolled_back')
    .eq('version', 'v0.2');
  if (e3) console.log(`[0024] error: ${e3.message}`);
  console.log(`[0024] v0.2 rolled_back: ${rolled?.length ?? 0}`);

  // (c) 0026: whatif_results 쿼리 가능
  const { error: e2 } = await c.from('whatif_results' as never).select('whatif_id').limit(0);
  console.log(`[0026] whatif_results 테이블: ${e2 ? `❌ ${(e2 as { message: string }).message}` : '✅ 쿼리 가능'}`);

  // (d) 전체 active 상태 확인
  const { data: allActive } = await c
    .from('prompt_versions')
    .select('prompt_name, version, status')
    .eq('status', 'active');
  console.log(`\n[현재 active 전체] ${allActive?.length ?? 0}행:`);
  for (const row of allActive ?? []) {
    console.log(`  - ${row.prompt_name}: ${row.version}`);
  }
}

main().catch((e) => {
  console.error('verify failed:', e);
  process.exit(1);
});
