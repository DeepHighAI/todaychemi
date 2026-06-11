import { createClient } from '@supabase/supabase-js';

import { computeChart } from '../src/lib/chart/compute';
import { DEFAULT_THEORY_PROFILE_VERSION } from '../src/types/chart';

// theory_profile_version 범프(v3 — 파생층 derived embedded) 후 기존
// user_charts / relation_charts 를 현재 버전으로 일괄 재계산하는 1회성 백필.
// 사용: pnpm tsx --env-file=.env.local scripts/recompute-charts-v3.ts
// - 멱등: 이미 현재 버전 row 가 있는 엔티티는 SKIP
// - 기존 버전 row 는 보존 (과거 hapcards FK·이력 무결성)
// - KASI 호출이 엔티티당 1회 발생하므로 직렬 실행
// - 미백필 유저는 lazy 경로(ensure-user-chart / lazy-relation-chart)가 커버
// (v2 백필 스크립트는 본 파일로 대체·삭제 — DEFAULT_THEORY_PROFILE_VERSION 구동이라 동작 동일했음)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const kasiKey = process.env.KASI_SERVICE_KEY;
if (!url || !key || !kasiKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / KASI_SERVICE_KEY');
  process.exit(1);
}

const c = createClient(url, key, { auth: { persistSession: false } });
const VERSION = DEFAULT_THEORY_PROFILE_VERSION;

type BirthFields = {
  birth_date: string;
  birth_date_calendar: 'solar' | 'lunar';
  is_lunar_leap: boolean;
  birth_time_knowledge: 'exact' | 'approximate' | 'unknown';
  birth_time: string | null;
};

let ok = 0;
let skipped = 0;
let failed = 0;

async function hasVersionRow(
  table: 'user_charts' | 'relation_charts',
  idCol: 'user_id' | 'relation_id',
  id: string,
): Promise<boolean> {
  const { count, error } = await c
    .from(table)
    .select('chart_id', { count: 'exact', head: true })
    .eq(idCol, id)
    .eq('theory_profile_version', VERSION);
  if (error) throw new Error(`${table} count failed: ${error.code ?? 'unknown'}`);
  return (count ?? 0) > 0;
}

async function recomputeOne(
  label: string,
  table: 'user_charts' | 'relation_charts',
  entityId: string,
  userId: string,
  birth: BirthFields & { gender: 'M' | 'F'; birth_longitude?: number | null },
): Promise<void> {
  try {
    const idCol = table === 'user_charts' ? 'user_id' : 'relation_id';
    if (await hasVersionRow(table, idCol, entityId)) {
      skipped += 1;
      console.log(`[SKIP] ${label} ${entityId} — ${VERSION} row 존재`);
      return;
    }

    const result = await computeChart(
      {
        entity_id: entityId,
        birth_date: birth.birth_date,
        birth_date_calendar: birth.birth_date_calendar,
        is_lunar_leap: birth.is_lunar_leap,
        birth_time_knowledge: birth.birth_time_knowledge,
        birth_time: birth.birth_time,
        gender: birth.gender,
        birth_longitude: birth.birth_longitude ?? null,
        theory_profile_version: VERSION,
      },
      kasiKey!,
    );

    const row =
      table === 'user_charts'
        ? {
            user_id: entityId,
            chart_hash: result.chart_hash,
            chart_core: result.chart_core,
            theory_profile_version: VERSION,
          }
        : {
            relation_id: entityId,
            user_id: userId,
            chart_hash: result.chart_hash,
            chart_core: result.chart_core,
            theory_profile_version: VERSION,
          };
    const { error } = await c
      .from(table)
      .upsert(row as never, { onConflict: 'chart_hash' });
    if (error) throw new Error(`upsert failed: ${error.code ?? 'unknown'}`);

    ok += 1;
    console.log(`[OK]   ${label} ${entityId} → 시주 ${result.chart_core.hour_pillar ?? 'null'}`);
  } catch (err) {
    failed += 1;
    console.error(`[FAIL] ${label} ${entityId} — ${err instanceof Error ? err.message : 'unknown'}`);
  }
}

async function main() {
  console.log(`recompute charts → theory_profile_version=${VERSION}\n`);

  const { data: users, error: usersErr } = await c
    .from('users')
    .select('user_id, birth_date, birth_date_calendar, is_lunar_leap, birth_time_knowledge, birth_time, gender');
  if (usersErr) {
    console.error('users select failed:', usersErr.message);
    process.exit(1);
  }
  for (const u of (users ?? []) as Array<BirthFields & { user_id: string; gender: 'M' | 'F' }>) {
    await recomputeOne('user    ', 'user_charts', u.user_id, u.user_id, u);
  }

  const { data: relations, error: relErr } = await c
    .from('relations')
    .select('relation_id, user_id, birth_date, birth_date_calendar, is_lunar_leap, birth_time_knowledge, birth_time, gender, birth_longitude');
  if (relErr) {
    console.error('relations select failed:', relErr.message);
    process.exit(1);
  }
  for (const r of (relations ?? []) as Array<
    BirthFields & { relation_id: string; user_id: string; gender: 'M' | 'F'; birth_longitude: number | null }
  >) {
    await recomputeOne('relation', 'relation_charts', r.relation_id, r.user_id, r);
  }

  console.log(`\nDONE — ok ${ok} / skip ${skipped} / fail ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('recompute failed:', e);
  process.exit(1);
});
