import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { computeChart } from '@/lib/chart/compute';
import { LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from '@/lib/legal/consent';
import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'Test1@test.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'test1234';

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
    userId = existing.id;
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password: TEST_PASSWORD,
    });
    if (updErr) throw new Error(`updateUserById(password) 실패: ${updErr.message}`);
    console.log(`✅ auth.users: ${TEST_EMAIL} 이미 존재 (id=${existing.id}) — 비밀번호 sync 완료`);
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
      consented_at: new Date().toISOString(),
      consented_tos_version: LEGAL_TERMS_VERSION,
      consented_privacy_version: LEGAL_PRIVACY_VERSION,
      age_confirmed: true,
    });
    if (userError) throw new Error(`users INSERT 실패: ${userError.message}`);
    console.log(`✅ public.users: user_id=${userId} INSERT 완료`);
  }

  // user_charts 멱등성 확인 — yunse 필드 존재 여부도 체크 (Y0/Y1 이전 시드 감지)
  const { data: existingChart } = await admin
    .from('user_charts')
    .select('user_id, chart_core')
    .eq('user_id', userId)
    .maybeSingle();

  const existingHasYunse = !!(existingChart as { chart_core?: { yunse?: unknown } } | null)?.chart_core?.yunse;

  if (existingChart && existingHasYunse) {
    console.log(`ℹ️  public.user_charts: user_id=${userId} 이미 존재 (yunse OK) — skip upsert`);
  } else {
    if (existingChart && !existingHasYunse) {
      console.log(`⚠️  public.user_charts: user_id=${userId} 존재하지만 yunse 없음 — 강제 재계산`);
      await admin.from('user_charts').delete().eq('user_id', userId);
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
  }

  // ── 인연(relation) 시드 ────────────────────────────────────────────────────
  const RELATION_SEEDS = [
    {
      mode: '일합' as const,
      nickname: '예시상대1',
      birth_date: '1991-03-15',
      birth_time: '14:30',
      gender: 'F' as const,
    },
    {
      mode: '친구합' as const,
      nickname: '예시친구1',
      birth_date: '1989-07-22',
      birth_time: '09:00',
      gender: 'M' as const,
    },
    {
      mode: '오래합' as const,
      nickname: '예시오래1',
      birth_date: '1985-11-08',
      birth_time: '20:15',
      gender: 'F' as const,
    },
    {
      mode: '돈합' as const,
      nickname: '예시돈1',
      birth_date: '1988-04-12',
      birth_time: '11:45',
      gender: 'M' as const,
    },
    {
      mode: '첫합' as const,
      nickname: '예시첫1',
      birth_date: '1995-09-30',
      birth_time: '17:20',
      gender: 'F' as const,
    },
    {
      mode: '썸합' as const,
      nickname: '예시썸1',
      birth_date: '1993-12-03',
      birth_time: '05:50',
      gender: 'M' as const,
    },
  ];

  for (const seed of RELATION_SEEDS) {
    // 멱등성: (user_id, nickname) 기존 확인
    const { data: existingRelation } = await admin
      .from('relations')
      .select('relation_id')
      .eq('user_id', userId)
      .eq('nickname', seed.nickname)
      .maybeSingle();

    let relationId: string;

    if (existingRelation) {
      console.log(`ℹ️  relations[${seed.mode}]: "${seed.nickname}" 이미 존재 — skip INSERT`);
      relationId = existingRelation.relation_id as string;
    } else {
      const { data: relData, error: relError } = await admin
        .from('relations')
        .insert({
          user_id: userId,
          nickname: seed.nickname,
          mode: seed.mode,
          birth_date: seed.birth_date,
          birth_date_calendar: 'solar',
          is_lunar_leap: false,
          birth_time_knowledge: 'exact',
          birth_time: seed.birth_time,
          gender: seed.gender,
          consent_confirmed: true,
          is_primary: false,
        })
        .select('relation_id')
        .single();
      if (relError) throw new Error(`relations INSERT(${seed.mode}) 실패: ${relError.message}`);
      relationId = relData.relation_id as string;
      console.log(`✅ relations[${seed.mode}]: "${seed.nickname}" INSERT 완료 (id=${relationId})`);
    }

    // relation_charts 멱등성 확인
    const { data: existingRelChart } = await admin
      .from('relation_charts')
      .select('chart_id')
      .eq('relation_id', relationId)
      .maybeSingle();

    if (existingRelChart) {
      console.log(`ℹ️  relation_charts[${seed.mode}]: relation_id=${relationId} 이미 존재 — skip upsert`);
      continue;
    }

    const relComputeResult = await computeChart(
      {
        entity_id: relationId,
        birth_date: seed.birth_date,
        birth_date_calendar: 'solar',
        is_lunar_leap: false,
        birth_time_knowledge: 'exact',
        birth_time: seed.birth_time,
        gender: seed.gender,
        theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
      },
      kasiServiceKey,
    );
    console.log(`✅ computeChart[${seed.mode}] 완료 (hash=${relComputeResult.chart_hash.slice(0, 12)}…)`);

    const { error: relChartError } = await admin.from('relation_charts').upsert(
      {
        relation_id: relationId,
        user_id: userId,
        chart_hash: relComputeResult.chart_hash,
        chart_core: relComputeResult.chart_core,
        theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
      },
      { onConflict: 'chart_hash' },
    );
    if (relChartError) throw new Error(`relation_charts upsert(${seed.mode}) 실패: ${relChartError.message}`);
    console.log(`✅ relation_charts[${seed.mode}]: upsert 완료`);
  }

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
