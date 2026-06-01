import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface SourceCheck {
  label: string;
  file: string;
  patterns: Array<string | RegExp>;
}

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const STATIC_DB_TESTS = [
  'tests/db/migrations.contract.test.ts',
  'tests/db/toss-v2-payment-hardening.migration.test.ts',
  'tests/db/legal-consent.migration.test.ts',
  'tests/db/free-talisman-rewards.migration.test.ts',
  'tests/db/share-rewards.migration.test.ts',
  'tests/db/0029-daily-haps-g2.test.ts',
];

const LIVE_RLS_TEST = 'tests/db/rls.integration.test.ts';

const SOURCE_CHECKS: SourceCheck[] = [
  {
    label: 'token ledger is read-only for users and service-role write-only',
    file: 'supabase/migrations/0009_token_ledger.sql',
    patterns: [
      'alter table public.token_ledger enable row level security',
      'ledger_own_read',
      /for\s+select\s+using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i,
    ],
  },
  {
    label: 'payments table is user-readable and server-write-only',
    file: 'supabase/migrations/0010_payments.sql',
    patterns: [
      'alter table public.payments enable row level security',
      'payments_own_read',
      /for\s+select\s+using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i,
    ],
  },
  {
    label: 'whatif results are owner-scoped by RLS',
    file: 'supabase/migrations/0026_whatif_results.sql',
    patterns: [
      'alter table public.whatif_results enable row level security',
      'whatif_results_own',
      /using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)\s+with\s+check\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i,
    ],
  },
  {
    label: 'relation memos are owner-scoped by RLS',
    file: 'supabase/migrations/20260528090000_relation_memos.sql',
    patterns: [
      'alter table public.relation_memos enable row level security',
      'relation_memos_own',
      /using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)\s+with\s+check\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i,
    ],
  },
  {
    label: 'share token tables expose only owner reads',
    file: 'supabase/migrations/20260524090000_hapcard_shares.sql',
    patterns: [
      'alter table public.hapcard_shares enable row level security',
      'hapcard_shares_own_read',
      'alter table public.hapcard_share_rewards enable row level security',
      'hapcard_share_rewards_own_read',
    ],
  },
  {
    label: 'legal consent tokens are service-role only',
    file: 'supabase/migrations/20260525110000_legal_consents.sql',
    patterns: [
      'alter table public.legal_consents enable row level security',
      'No anon/authenticated policies',
    ],
  },
  {
    label: 'live RLS integration test is opt-in and present',
    file: LIVE_RLS_TEST,
    patterns: [
      'expectAnonDenied',
      'expectServiceRoleAccess',
      'service_role SELECT',
    ],
  },
  {
    label: 'Vitest excludes integration tests unless explicitly enabled',
    file: 'vitest.config.ts',
    patterns: [
      'RUN_INTEGRATION',
      '**/*.integration.test.ts',
      'includeIntegrationTests',
    ],
  },
];

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function requireEnv(keys: string[]): boolean {
  let ok = true;
  for (const key of keys) {
    const exists = Boolean(process.env[key]?.trim());
    console.log(`[env] ${exists ? 'OK' : 'FAIL'} ${key}`);
    ok = exists && ok;
  }
  return ok;
}

function checkSourceInvariant(check: SourceCheck): boolean {
  const absolutePath = resolve(process.cwd(), check.file);
  if (!existsSync(absolutePath)) {
    console.log(`[source] FAIL ${check.label}: missing ${check.file}`);
    return false;
  }

  const source = readFileSync(absolutePath, 'utf8');
  const missing = check.patterns.filter((pattern) => {
    if (typeof pattern === 'string') return !source.includes(pattern);
    return !pattern.test(source);
  });

  if (missing.length > 0) {
    console.log(`[source] FAIL ${check.label}`);
    for (const pattern of missing) {
      console.log(`  missing: ${pattern.toString()}`);
    }
    return false;
  }

  console.log(`[source] OK ${check.label}`);
  return true;
}

function runVitest(
  label: string,
  files: string[],
  extraEnv: Record<string, string | undefined> = {},
): boolean {
  const missingFiles = files.filter((file) => !existsSync(resolve(process.cwd(), file)));
  if (missingFiles.length > 0) {
    console.log(`[vitest] FAIL ${label}`);
    for (const file of missingFiles) {
      console.log(`  missing: ${file}`);
    }
    return false;
  }

  console.log('');
  console.log(`[vitest] ${label}`);
  const result = spawnSync(PNPM, ['vitest', 'run', ...files], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const ok = result.status === 0;
  console.log(`[vitest] ${ok ? 'OK' : 'FAIL'} ${label}`);
  return ok;
}

function main() {
  loadDotEnvLocal();

  console.log('DB/RLS readiness check');
  console.log('This command runs static DB checks and live RLS integration tests; it does not apply migrations.');
  console.log('');

  let ok = true;

  for (const check of SOURCE_CHECKS) {
    ok = checkSourceInvariant(check) && ok;
  }

  ok = runVitest('static migration contract tests', STATIC_DB_TESTS) && ok;

  const hasEnv = requireEnv([
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]);
  ok = hasEnv && ok;

  if (hasEnv) {
    ok = runVitest('live Supabase RLS integration tests', [LIVE_RLS_TEST], {
      RUN_INTEGRATION: '1',
    }) && ok;
  }

  console.log('');
  console.log('Manual launch checks still required:');
  console.log('- Confirm remote migrations match local migrations before production deploy.');
  console.log('- Re-run Supabase security advisor after protected RPC hardening.');
  console.log('- Keep SECURITY DEFINER RPC checks separate from table RLS checks.');

  if (!ok) {
    console.error('\nDB/RLS readiness FAIL');
    process.exit(1);
  }

  console.log('\nDB/RLS readiness PASS');
}

main();
