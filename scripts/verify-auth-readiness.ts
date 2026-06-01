import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface SourceCheck {
  file: string;
  label: string;
  pattern: RegExp;
}

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const REQUIRED_ENV = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY',
  'KAKAO_ADMIN_KEY',
];

const SOURCE_CHECKS: SourceCheck[] = [
  {
    file: 'src/lib/auth/oauth.ts',
    label: 'OAuth start uses shared /auth/callback redirect',
    pattern: /new URL\('\/auth\/callback'[\s\S]*signInWithOAuth/,
  },
  {
    file: 'src/app/auth/callback/route.ts',
    label: 'Auth callback exchanges code and handles legal consent',
    pattern: /exchangeCodeForSession[\s\S]*claimLegalConsentFromCookie[\s\S]*social-consent/,
  },
  {
    file: 'supabase/config.toml',
    label: 'Email/password policy is 8 chars plus letters_digits',
    pattern: /minimum_password_length\s*=\s*8[\s\S]*password_requirements\s*=\s*"letters_digits"/,
  },
  {
    file: 'supabase/config.toml',
    label: 'Auth sign-in/sign-up rate limit is 10 per 5 minutes',
    pattern: /sign_in_sign_ups\s*=\s*10/,
  },
  {
    file: 'supabase/config.toml',
    label: 'Kakao email is optional in local provider config',
    pattern: /\[auth\.external\.kakao\][\s\S]*email_optional\s*=\s*true/,
  },
];

const FOCUSED_TESTS = [
  'tests/auth/google.test.ts',
  'tests/auth/kakao.test.ts',
  'tests/auth/callback.test.ts',
  'tests/app/api/legal/consent/route.test.ts',
  'tests/app/api/legal/social-consent/route.test.ts',
  'tests/lib/auth/email.test.ts',
];

function parseEnvFile(path: string): Map<string, string> {
  const entries = new Map<string, string>();
  if (!existsSync(path)) return entries;

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries.set(key, value);
  }

  return entries;
}

function loadEnv(envFile: string): Map<string, string> {
  const env = parseEnvFile(envFile);
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && value.length > 0) env.set(key, value);
  }
  return env;
}

function hasValue(env: Map<string, string>, key: string): boolean {
  return (env.get(key) ?? '').trim().length > 0;
}

function checkProductionOrigin(env: Map<string, string>): boolean {
  const origin = env.get('NEXT_PUBLIC_APP_URL')?.trim();
  if (!origin) {
    console.log('[auth origin] FAIL NEXT_PUBLIC_APP_URL missing');
    return false;
  }

  try {
    const url = new URL(origin);
    const ok = url.protocol === 'https:'
      && url.hostname !== 'localhost'
      && url.hostname !== '127.0.0.1'
      && url.pathname === '/'
      && url.search === ''
      && url.hash === ''
      && !origin.endsWith('/');
    console.log(`[auth origin] ${ok ? 'OK' : 'FAIL'} ${origin}`);
    return ok;
  } catch {
    console.log('[auth origin] FAIL NEXT_PUBLIC_APP_URL must be an absolute URL');
    return false;
  }
}

function checkEnv(env: Map<string, string>): boolean {
  let ok = true;
  for (const key of REQUIRED_ENV) {
    const present = hasValue(env, key);
    console.log(`[env] ${present ? 'OK' : 'FAIL'} ${key}`);
    ok = present && ok;
  }
  return checkProductionOrigin(env) && ok;
}

function checkSource(check: SourceCheck): boolean {
  const fullPath = resolve(process.cwd(), check.file);
  if (!existsSync(fullPath)) {
    console.log(`[source] FAIL ${check.label} - missing ${check.file}`);
    return false;
  }

  const source = readFileSync(fullPath, 'utf8');
  const ok = check.pattern.test(source);
  console.log(`[source] ${ok ? 'OK' : 'FAIL'} ${check.label}`);
  return ok;
}

function runFocusedTests(): boolean {
  console.log('');
  console.log('Focused Auth tests:');
  console.log(`$ ${PNPM} vitest run ${FOCUSED_TESTS.join(' ')}`);

  const result = spawnSync(PNPM, ['vitest', 'run', ...FOCUSED_TESTS], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result.status === 0;
}

function main() {
  const envArgIndex = process.argv.indexOf('--env-file');
  const envFile = envArgIndex >= 0
    ? resolve(process.cwd(), process.argv[envArgIndex + 1] ?? '')
    : resolve(process.cwd(), '.env.local');
  const env = loadEnv(envFile);

  console.log('Auth readiness check');
  console.log(`Env source: ${envFile} + process.env`);
  console.log('');

  let ok = checkEnv(env);
  for (const check of SOURCE_CHECKS) ok = checkSource(check) && ok;
  ok = runFocusedTests() && ok;

  console.log('');
  console.log('Manual dashboard checks still required:');
  console.log('- Supabase Auth Site URL equals production NEXT_PUBLIC_APP_URL.');
  console.log('- Supabase Auth redirect URLs include /auth/callback for production, preview, and localhost as intended.');
  console.log('- Google and Kakao providers are enabled in the Supabase Dashboard.');
  console.log('- Kakao provider allows accounts without email, matching docs/specs/auth.md.');
  console.log('- Leaked-password protection decision is applied in the Supabase Dashboard.');

  if (!ok) {
    console.error('\nAuth readiness FAIL');
    process.exit(1);
  }

  console.log('\nAuth readiness PASS');
}

main();
