import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { computeChart } from '@/lib/chart/compute';
import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';

const TEST_EMAIL = 'Test1@test.com';
const TEST_PASSWORD = 'test1234';

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

async function main() {
  loadDotEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const kasiServiceKey = process.env.KASI_SERVICE_KEY!;

  if (!supabaseUrl || !serviceRoleKey || !kasiServiceKey) {
    throw new Error('필수 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / KASI_SERVICE_KEY');
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 멱등성: 이미 존재하는지 먼저 확인
  const { data: existingList } = await admin.auth.admin.listUsers();
  const existing = existingList?.users.find((u) => u.email?.toLowerCase() === TEST_EMAIL.toLowerCase());

  let userId: string;

  if (existing) {
    console.log(`ℹ️  auth.users: ${TEST_EMAIL} 이미 존재 (id=${existing.id}) — skip createUser`);
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser 실패: ${error.message}`);
    userId = data.user.id;
    console.log(`✅ auth.users: ${TEST_EMAIL} 생성 완료 (id=${userId})`);
  }

  // public.users 멱등성 확인
  const { data: existingUser } = await admin
    .from('users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingUser) {
    console.log(`ℹ️  public.users: user_id=${userId} 이미 존재 — skip INSERT`);
  } else {
    const { error: userError } = await admin.from('users').insert({
      user_id: userId,
      nickname: '테스트1',
      birth_date: '1990-01-01',
      birth_date_calendar: 'solar',
      is_lunar_leap: false,
      birth_time_knowledge: 'exact',
      birth_time: '12:00',
      gender: 'M',
      consented_tos_version: 'v1',
    });
    if (userError) throw new Error(`users INSERT 실패: ${userError.message}`);
    console.log(`✅ public.users: user_id=${userId} INSERT 완료`);
  }

  // user_charts 멱등성 확인
  const { data: existingChart } = await admin
    .from('user_charts')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingChart) {
    console.log(`ℹ️  public.user_charts: user_id=${userId} 이미 존재 — skip upsert`);
    console.log('\n✅ 시드 완료 (멱등 — 이미 존재)');
    return;
  }

  // chart 계산
  const computeResult = await computeChart(
    {
      entity_id: userId,
      birth_date: '1990-01-01',
      birth_date_calendar: 'solar',
      is_lunar_leap: false,
      birth_time_knowledge: 'exact',
      birth_time: '12:00',
      gender: 'M',
      theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
    },
    kasiServiceKey,
  );
  console.log(`✅ computeChart 완료 (hash=${computeResult.chart_hash.slice(0, 12)}…)`);

  const { error: chartError } = await admin.from('user_charts').upsert(
    {
      user_id: userId,
      chart_hash: computeResult.chart_hash,
      chart_core: computeResult.chart_core,
      theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
    },
    { onConflict: 'chart_hash' },
  );
  if (chartError) throw new Error(`user_charts upsert 실패: ${chartError.message}`);
  console.log(`✅ public.user_charts: upsert 완료`);

  console.log('\n✅ 시드 완료');
  console.log(`   email    : ${TEST_EMAIL}`);
  console.log(`   password : ${TEST_PASSWORD}`);
  console.log(`   user_id  : ${userId}`);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/seed-test-user.ts')) {
  main().catch((err) => {
    console.error('❌ 시드 실패:', err);
    process.exit(1);
  });
}
