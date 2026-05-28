// QA helper — recent error_events 조회 (Task 1 instrumentation 동작 검증)
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
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await c
    .from('error_events')
    .select('error_code, context, stack, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    console.error('query error:', error.message);
    process.exit(1);
  }
  console.log(`rows: ${data?.length ?? 0} (since ${since})`);
  for (const r of data ?? []) {
    console.log('---');
    console.log('code:', r.error_code);
    const ctx = r.context as { phase?: string; total_ms?: number; phases?: Array<{ name: string; ms: number }>; source?: string } | null;
    console.log('phase:', ctx?.phase);
    console.log('total_ms:', ctx?.total_ms);
    console.log('phases:', JSON.stringify(ctx?.phases));
    console.log('source:', ctx?.source);
    console.log('stack:', (r.stack ?? '').slice(0, 300));
    console.log('created:', r.created_at);
  }
}
main();
