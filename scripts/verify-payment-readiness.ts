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
  const tossHardeningPath = resolve(
    process.cwd(),
    'supabase/migrations/20260530090000_toss_v2_payment_hardening.sql',
  );
  const featurePayPerUsePath = resolve(
    process.cwd(),
    'supabase/migrations/20260601000000_feature_pay_per_use.sql',
  );

  if (!existsSync(tossHardeningPath)) {
    console.log('[local migration] FAIL missing 20260530090000_toss_v2_payment_hardening.sql');
    return false;
  }
  if (!existsSync(featurePayPerUsePath)) {
    console.log('[local migration] FAIL missing 20260601000000_feature_pay_per_use.sql');
    return false;
  }

  const tossSql = readFileSync(tossHardeningPath, 'utf8');
  const featureSql = readFileSync(featurePayPerUsePath, 'utf8');
  const hasCustomerKey = tossSql.includes('toss_customer_key');
  const hasPurchaseUniqueIndex = tossSql.includes('token_ledger_purchase_reference_unique_idx');
  const hasFeatureColumns =
    featureSql.includes('charge_type')
    && featureSql.includes('feature_id')
    && featureSql.includes('feature_ref');
  const hasFeatureConfirmRpc = featureSql.includes('confirm_feature_payment');
  const dropsLegacyTokenPurchase = featureSql.includes('drop function if exists public.confirm_token_purchase');

  console.log(`[local migration] ${hasCustomerKey ? 'OK' : 'FAIL'} toss_customer_key`);
  console.log(`[local migration] ${hasPurchaseUniqueIndex ? 'OK' : 'FAIL'} purchase reference unique index`);
  console.log(`[local migration] ${hasFeatureColumns ? 'OK' : 'FAIL'} pay-per-use payment feature columns`);
  console.log(`[local migration] ${hasFeatureConfirmRpc ? 'OK' : 'FAIL'} confirm_feature_payment RPC`);
  console.log(`[local migration] ${dropsLegacyTokenPurchase ? 'OK' : 'FAIL'} legacy token-purchase RPC removal`);

  return hasCustomerKey
    && hasPurchaseUniqueIndex
    && hasFeatureColumns
    && hasFeatureConfirmRpc
    && dropsLegacyTokenPurchase;
}

function checkPaymentSpec(): boolean {
  const specPath = resolve(process.cwd(), 'docs/specs/payments.md');
  if (!existsSync(specPath)) {
    console.log('[local spec] FAIL missing docs/specs/payments.md');
    return false;
  }

  const source = readFileSync(specPath, 'utf8');
  const hasCurrentConfirmChecklist = source.includes(
    '`/api/payments/feature/confirm` 서버 저장 금액 검증 확인',
  );
  const hasStaleTokenConfirmChecklist = /`\/api\/payments\/confirm`\s+서버 저장 금액 검증 확인/.test(source);

  console.log(`[local spec] ${hasCurrentConfirmChecklist ? 'OK' : 'FAIL'} feature confirm amount verification checklist`);
  console.log(`[local spec] ${!hasStaleTokenConfirmChecklist ? 'OK' : 'FAIL'} no stale token-charge confirm checklist`);

  return hasCurrentConfirmChecklist && !hasStaleTokenConfirmChecklist;
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
  ok = checkPaymentSpec() && ok;

  ok = await checkSelect(
    client,
    'payments pay-per-use columns',
    'payments',
    [
      'payment_id',
      'user_id',
      'toss_order_id',
      'toss_customer_key',
      'toss_payment_key',
      'product_id',
      'charge_type',
      'feature_id',
      'feature_ref',
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
  console.log('Remaining dashboard checks:');
  console.log('- Keep pnpm db:push:dry PASS so production payment migrations remain up to date.');
  console.log('- Supabase advisor must show token/payment SECURITY DEFINER RPCs are not executable by anon/authenticated.');
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
