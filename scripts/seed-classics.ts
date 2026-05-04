import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

// classics 테이블 review_status enum (0021_classics.sql 와 동일)
const REVIEW_STATUSES = [
  'draft',
  'approved_ai_pending_human',
  'approved_ai_and_crowd',
  'approved_ai_crowd_and_beta',
  'deprecated',
] as const;

const ClassicYamlSchema = z.object({
  asset_id: z.string().min(1),
  source_title: z.string().min(1),
  source_chapter: z.string().min(1),
  original_text: z.string().min(1),
  original_reading: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  modern_translation: z.string().min(1),
  topic_tags: z.array(z.string()).default([]),
  version: z.string().min(1),
  review_status: z.enum(REVIEW_STATUSES),
});

export type ClassicYamlInput = z.infer<typeof ClassicYamlSchema>;

export interface ClassicRow extends ClassicYamlInput {
  embedding: number[];
}

export interface EmbedClassicsDeps {
  embeddings: {
    create: (params: { model: string; input: string }) => Promise<{
      data: Array<{ embedding: number[] }>;
    }>;
  };
}

export function loadClassicYamls(dir: string): ClassicYamlInput[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();

  const rows: ClassicYamlInput[] = [];
  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf-8');
    const parsed = parseYaml(raw);
    rows.push(ClassicYamlSchema.parse(parsed));
  }
  return rows;
}

export async function embedClassics(
  inputs: ClassicYamlInput[],
  deps: EmbedClassicsDeps,
): Promise<ClassicRow[]> {
  const rows: ClassicRow[] = [];
  for (const input of inputs) {
    const inputText = `${input.original_text} ${input.modern_translation}`;
    const res = await deps.embeddings.create({
      model: 'text-embedding-3-small',
      input: inputText,
    });
    rows.push({ ...input, embedding: res.data[0].embedding });
  }
  return rows;
}

export async function runSeedClassics(
  client: SupabaseClient,
  rows: ClassicRow[],
): Promise<{ inserted: number }> {
  const { error } = await client
    .from('classics')
    .upsert(rows, { onConflict: 'asset_id' });
  if (error) throw new Error(error.message);
  return { inserted: rows.length };
}

// --- CLI 진입점 ---

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
  const { createServiceRoleClient } = await import('@/lib/supabase/service-role');
  const { createEmbeddingsClient } = await import('@/lib/llm/clients');
  const dir = join(process.cwd(), 'rag_content', 'classics');
  const inputs = loadClassicYamls(dir);
  const rows = await embedClassics(inputs, {
    embeddings: createEmbeddingsClient(),
  });
  const client = createServiceRoleClient();
  const { inserted } = await runSeedClassics(client, rows);
  console.log(`✅ ${inserted} classics seeded`);
}

// CLI entry: tsx scripts/seed-classics.ts
if (
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('scripts/seed-classics.ts')
) {
  main().catch((err) => {
    console.error('❌ seed failed:', err);
    process.exit(1);
  });
}
