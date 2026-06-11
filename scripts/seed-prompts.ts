import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

// 6모드 합카드 프롬프트 (v0.15 schema — actions / ohaeng_interpretation / Plain-language / derived·cross_analysis 등 strict)
const HAPCARD_MODE_NAMES = new Set([
  'ilhap', 'chinguhap', 'donhap', 'cheothap', 'sseomhap', 'oraehap',
]);

// 합카드 외 프롬프트 (G2 F4: today_with_relation, daily_hap) — content schema 가 다르므로 strict 체크 면제.
// Task 2 (ADR-008): daily_hap 도 DB 시드 — today/openai.ts 가 DB-backed 로 전환되어 canary 라우팅 가능.
const OTHER_VALID_NAMES = new Set([
  'today_with_relation',
  'daily_hap',
]);

const VALID_NAMES = new Set([...HAPCARD_MODE_NAMES, ...OTHER_VALID_NAMES]);

export { HAPCARD_MODE_NAMES, OTHER_VALID_NAMES };

const VERSION_RE = /^>\s*Version:\s*(v\d+\.\d+)/m;
// Task 2 (ADR-008): canary frontmatter — 같은 본문으로 active + canary row 동시 시드.
//   `> CanaryVersion: v0.16` `> CanaryRatio: 0.05`
const CANARY_VERSION_RE = /^>\s*CanaryVersion:\s*(v\d+\.\d+)/m;
const CANARY_RATIO_RE = /^>\s*CanaryRatio:\s*([\d.]+)/m;

export type PromptRow = Database['public']['Tables']['prompt_versions']['Insert'];

// vitest.config.ts 와 동일한 fs 기반 .env.local 파서 — 의존성 0.
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

export function loadPromptFiles(dir: string): PromptRow[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const rows: PromptRow[] = [];
  for (const file of files) {
    const name = file.replace(/\.md$/, '');
    if (!VALID_NAMES.has(name)) continue;
    const content = readFileSync(join(dir, file), 'utf-8');
    const match = content.match(VERSION_RE);
    if (!match) throw new Error(`${file}: Version 헤더 없음`);
    rows.push({
      prompt_name: name,
      version: match[1],
      content,
      status: 'active',
      canary_ratio: 0,
    });
    // Task 2 (ADR-008): CanaryVersion 헤더가 있으면 같은 본문으로 canary row 추가 시드.
    // 본문 변경 없는 routing 인프라 검증 모드 — 향후 본문 micro-tweak 시 분리.
    const canaryVersionMatch = content.match(CANARY_VERSION_RE);
    if (canaryVersionMatch) {
      const ratioMatch = content.match(CANARY_RATIO_RE);
      const canaryRatio = ratioMatch ? Number(ratioMatch[1]) : 0.05;
      rows.push({
        prompt_name: name,
        version: canaryVersionMatch[1],
        content,
        status: 'canary',
        canary_ratio: canaryRatio,
      });
    }
  }
  return rows;
}

// SupabaseClient without Database generic — avoids conditional type inference issue with typed schema.
export async function runSeed(client: SupabaseClient, rows: PromptRow[]) {
  const names = rows.map((r) => r.prompt_name);
  // Archive existing active + canary versions before inserting new ones.
  // (prompt_versions_one_active partial unique index: only 1 active per prompt_name)
  // Task 2 (ADR-008): canary 도 함께 archive — 새 canary 시드 시 이전 canary 잔존 방지.
  const { error: archiveError } = await client
    .from('prompt_versions')
    .update({ status: 'rolled_back' })
    .in('prompt_name', names)
    .in('status', ['active', 'canary']);
  if (archiveError) throw archiveError;
  const { error } = await client
    .from('prompt_versions')
    .upsert(rows, { onConflict: 'prompt_name,version' });
  if (error) throw error;
  return { inserted: rows.length };
}

async function main() {
  loadDotEnvLocal();
  const rows = loadPromptFiles(join(process.cwd(), 'prompts', 'system'));
  const client = createServiceRoleClient();
  const { inserted } = await runSeed(client, rows);
  console.log(`✅ ${inserted} prompt versions seeded`);
}

// CLI entry: tsx scripts/seed-prompts.ts
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/seed-prompts.ts')) {
  main().catch((err) => {
    console.error('❌ seed failed:', err);
    process.exit(1);
  });
}
