// QA cleanup — probe row 삭제 + 최근 today trace 조회
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotEnvLocal();

import { createServiceRoleClient } from '@/lib/supabase/service-role';

async function main() {
  const c = createServiceRoleClient();
  const { error: delErr } = await c
    .from('error_events')
    .delete()
    .eq('error_code', 'QA_TEST_PROBE');
  console.log('probe delete:', delErr ? `❌ ${delErr.message}` : '✅ done');
}
main();
