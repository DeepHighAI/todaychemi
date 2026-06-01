import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ReadOnlySupabaseClient {
  from(table: string): {
    select(columns: string): {
      limit(count: number): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
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

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    console.error(`Missing ${key}`);
    process.exit(1);
  }
  return value;
}

function checkLocalMigration(): boolean {
  const migrationPath = resolve(
    process.cwd(),
    'supabase/migrations/20260530090000_toss_v2_payment_hardening.sql',
  );

  if (!existsSync(migrationPath)) {
    console.log('[local migration] FAIL missing 20260530090000_toss_v2_payment_hardening.sql');
    return false;
  }

  const sql = readFileSync(migrationPath, 'utf8');
  const hasCustomerKey = sql.includes('toss_customer_key');
  const hasPurchaseUniqueIndex = sql.includes('token_ledger_purchase_reference_unique_idx');

  console.log(`[local migration] ${hasCustomerKey ? 'OK' : 'FAIL'} toss_customer_key`);
  console.log(`[local migration] ${hasPurchaseUniqueIndex ? 'OK' : 'FAIL'} purchase reference unique index`);

  return hasCustomerKey && hasPurchaseUniqueIndex;
}

async function checkSelect(
  client: ReadOnlySupabaseClient,
  label: string,
  table: string,
  columns: string,
): Promise<boolean> {
  const { error } = await client
    .from(table)
    .select(columns)
    .limit(0);

  if (error) {
    console.log(`[remote ${label}] FAIL ${error.message}`);
    return false;
  }

  console.log(`[remote ${label}] OK ${columns}`);
  return true;
}

async function main() {
  loadDotEnvLocal();

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const client = createClient(url, key, { auth: { persistSession: false } }) as unknown as ReadOnlySupabaseClient;

  let ok = true;

  ok = checkLocalMigration() && ok;

  ok = await checkSelect(
    client,
    'payments charge columns',
    'payments',
    [
      'payment_id',
      'user_id',
      'toss_order_id',
      'toss_customer_key',
      'toss_payment_key',
      'product_id',
      'amount_krw',
      'token_amount',
      'status',
      'failure_code',
      'failure_message',
      'receipt_url',
      'created_at',
      'updated_at',
    ].join(','),
  ) && ok;

  ok = await checkSelect(
    client,
    'token ledger columns',
    'token_ledger',
    'ledger_id,user_id,delta,reason,reference_id,balance_after,created_at',
  ) && ok;

  console.log('');
  console.log('Manual security checks still required:');
  console.log('- Supabase advisor must show token/payment SECURITY DEFINER RPCs are not executable by anon/authenticated.');
  console.log('- Confirm production has the 20260530090000 migration applied in Supabase migration history.');
  console.log('- Verify Toss live keys and payment dashboard settings outside the database.');

  if (!ok) {
    console.error('\nPayment readiness FAIL');
    process.exit(1);
  }

  console.log('\nPayment readiness PASS');
}

main().catch((err) => {
  console.error('verify failed:', err);
  process.exit(1);
});
