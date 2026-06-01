import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface FunctionCheck {
  name: string;
  signaturePattern: string;
  reason: string;
}

const FUNCTIONS: FunctionCheck[] = [
  {
    name: 'confirm_token_purchase',
    signaturePattern: String.raw`uuid\s*,\s*text\s*,\s*text\s*,\s*text\s*,\s*(?:int|integer)\s*,\s*(?:int|integer)\s*,\s*text\s*,\s*(?:timestamptz|timestamp\s+with\s+time\s+zone)`,
    reason: 'credits purchased tokens and confirms payments',
  },
  {
    name: 'deduct_tokens',
    signaturePattern: String.raw`uuid\s*,\s*(?:int|integer)\s*,\s*text\s*,\s*text`,
    reason: 'spends user token balance',
  },
  {
    name: 'deduct_tokens_once',
    signaturePattern: String.raw`uuid\s*,\s*(?:int|integer)\s*,\s*text\s*,\s*text`,
    reason: 'spends user token balance idempotently by feature reference',
  },
  {
    name: 'refund_tokens',
    signaturePattern: String.raw`uuid\s*,\s*(?:int|integer)\s*,\s*text\s*,\s*text`,
    reason: 'credits refund token balance',
  },
  {
    name: 'refund_tokens_once',
    signaturePattern: String.raw`uuid\s*,\s*(?:int|integer)\s*,\s*text\s*,\s*text`,
    reason: 'credits refund token balance idempotently by feature reference',
  },
  {
    name: 'award_free_talisman_session_rewards',
    signaturePattern: String.raw`uuid\s*,\s*(?:timestamptz|timestamp\s+with\s+time\s+zone)\s*,\s*(?:timestamptz|timestamp\s+with\s+time\s+zone)`,
    reason: 'credits signup/session bonus tokens',
  },
  {
    name: 'award_hapcard_share_reward',
    signaturePattern: String.raw`uuid\s*,\s*text\s*,\s*text`,
    reason: 'credits Kakao share reward tokens',
  },
  {
    name: 'match_classics',
    signaturePattern: String.raw`(?:public\.)?vector\s*,\s*(?:int|integer)\s*,\s*text\[\]`,
    reason: 'bypasses RLS for RAG classic retrieval',
  },
  {
    name: 'purge_deleted_users',
    signaturePattern: '',
    reason: 'deletes auth users after grace period',
  },
];

function loadMigrationSql(): string {
  const dir = resolve(process.cwd(), 'supabase/migrations');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(resolve(dir, file), 'utf8'))
    .join('\n\n');
}

function compactSql(sql: string): string {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function fnPattern(fn: FunctionCheck): string {
  return fn.signaturePattern
    ? String.raw`public\.${fn.name}\s*\(\s*${fn.signaturePattern}\s*\)`
    : String.raw`public\.${fn.name}\s*\(\s*\)`;
}

function hasSearchPath(sql: string, fn: FunctionCheck): boolean {
  const definitionPattern = new RegExp(
    String.raw`create\s+or\s+replace\s+function\s+public\.${fn.name}\s*\([^;]*?\)\s+[^$;]*?set\s+search_path\s*=\s*public\s+as\s+\$\$`,
    'i',
  );
  const alterPattern = new RegExp(
    String.raw`alter\s+function\s+${fnPattern(fn)}\s+set\s+search_path\s*=\s*public`,
    'i',
  );
  return definitionPattern.test(sql) || alterPattern.test(sql);
}

function hasRoleRevoke(sql: string, fn: FunctionCheck, role: 'anon' | 'authenticated'): boolean {
  return new RegExp(
    String.raw`revoke\s+(?:all|execute)\s+on\s+function\s+${fnPattern(fn)}\s+from\s+${role}\b`,
    'i',
  ).test(sql);
}

function hasServiceRoleGrant(sql: string, fn: FunctionCheck): boolean {
  return new RegExp(
    String.raw`grant\s+execute\s+on\s+function\s+${fnPattern(fn)}\s+to\s+service_role\b`,
    'i',
  ).test(sql);
}

function main() {
  const rawSql = loadMigrationSql();
  const sql = compactSql(rawSql);

  let ok = true;

  console.log('Supabase security readiness check');
  console.log('Source: supabase/migrations/*.sql');
  console.log('');

  for (const fn of FUNCTIONS) {
    console.log(`${fn.name} - ${fn.reason}`);

    const searchPath = hasSearchPath(sql, fn);
    const anonRevoke = hasRoleRevoke(sql, fn, 'anon');
    const authenticatedRevoke = hasRoleRevoke(sql, fn, 'authenticated');
    const serviceGrant = hasServiceRoleGrant(sql, fn);

    console.log(`  [${searchPath ? 'OK' : 'FAIL'}] fixed search_path`);
    console.log(`  [${anonRevoke ? 'OK' : 'FAIL'}] revoke execute from anon`);
    console.log(`  [${authenticatedRevoke ? 'OK' : 'FAIL'}] revoke execute from authenticated`);
    console.log(`  [${serviceGrant ? 'OK' : 'FAIL'}] grant execute to service_role`);

    ok = searchPath && anonRevoke && authenticatedRevoke && serviceGrant && ok;
  }

  console.log('');
  console.log('Manual Supabase checks still required:');
  console.log('- Apply the approved security migration to production Supabase.');
  console.log('- Re-run Supabase security advisors after migration application.');
  console.log('- Verify has_function_privilege for anon/authenticated is false on protected RPCs.');

  if (!ok) {
    console.error('\nSupabase security readiness FAIL');
    process.exit(1);
  }

  console.log('\nSupabase security readiness PASS');
}

main();
