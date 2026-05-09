import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const VALID_NAMES = new Set([
  'ilhap', 'chinguhap', 'donhap', 'cheothap', 'sseomhap', 'oraehap',
]);

const VERSION_RE = /^>\s*Version:\s*(v\d+\.\d+)/m;

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
    });
  }
  return rows;
}

// SupabaseClient without Database generic — avoids conditional type inference issue with typed schema.
export async function runSeed(client: SupabaseClient, rows: PromptRow[]) {
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
