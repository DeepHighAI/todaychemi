// QA helper — daily_haps row 조회 (오늘 카드 LLM 응답 vs fallback 식별)
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
  const { data, error } = await c
    .from('daily_haps')
    .select('user_id, target_date, headline, headline_reason, primary_relation_id, relation_nickname, today_compat_score, llm_model')
    .order('target_date', { ascending: false })
    .limit(5);
  if (error) {
    console.error('query error:', error.message);
    process.exit(1);
  }
  console.log(`rows: ${data?.length ?? 0}`);
  for (const r of data ?? []) {
    console.log('---');
    console.log('user_id     :', r.user_id);
    console.log('target_date :', r.target_date);
    console.log('llm_model   :', r.llm_model);
    console.log('headline    :', r.headline);
    console.log('reason      :', r.headline_reason);
    console.log('relation_id :', r.primary_relation_id);
    console.log('nickname    :', r.relation_nickname);
    console.log('compat      :', r.today_compat_score);
    console.log('created     :', r.created_at);
  }
}
main();
