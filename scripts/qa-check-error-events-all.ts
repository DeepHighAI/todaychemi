// QA helper — error_events 전체 진단 + RLS policy 확인
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
  // 전체 row 카운트
  const { count, error: countErr } = await c
    .from('error_events')
    .select('*', { count: 'exact', head: true });
  console.log('total rows:', count);
  if (countErr) console.error('count error:', countErr.message);
  // 최근 10건 (모든 source)
  const { data, error } = await c
    .from('error_events')
    .select('error_code, context, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) console.error('select error:', error.message);
  console.log(`recent: ${data?.length ?? 0}`);
  for (const r of data ?? []) {
    const ctx = r.context as { source?: string; phase?: string } | null;
    console.log(`  ${r.created_at} | ${r.error_code} | source=${ctx?.source} phase=${ctx?.phase}`);
  }

  // INSERT 시도 — service-role 로 (RLS bypass)
  console.log('\n[insert test as service-role]');
  const { error: insertErr } = await c.from('error_events').insert({
    error_code: 'QA_TEST_PROBE',
    user_id: null,
    context: { source: 'qa.probe', phase: 'test', total_ms: 0 },
    stack: 'qa-check-error-events-all probe',
  });
  console.log('insert result:', insertErr ? `❌ ${insertErr.message}` : '✅ success');
}
main();
