import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

function envValue(env: Map<string, string>, key: string): string {
  return env.get(key)?.trim() ?? '';
}

function checkPrefix(label: string, value: string, prefix: string): boolean {
  if (!value) {
    console.log(`[env] FAIL ${label} missing`);
    return false;
  }

  const ok = value.startsWith(prefix);
  console.log(`[env] ${ok ? 'OK' : 'FAIL'} ${label} uses ${prefix}*`);
  return ok;
}

function checkUnset(label: string, value: string): boolean {
  const ok = value.length === 0;
  console.log(`[env] ${ok ? 'OK' : 'FAIL'} ${label} unset for launch canonical env`);
  return ok;
}

function checkProductionOrigin(value: string): boolean {
  if (!value) {
    console.log('[origin] FAIL NEXT_PUBLIC_APP_URL missing');
    return false;
  }

  try {
    const url = new URL(value);
    const ok = url.protocol === 'https:'
      && url.hostname !== 'localhost'
      && url.hostname !== '127.0.0.1'
      && url.pathname === '/'
      && url.search === ''
      && url.hash === ''
      && !value.endsWith('/');
    console.log(`[origin] ${ok ? 'OK' : 'FAIL'} production origin shape`);
    return ok;
  } catch {
    console.log('[origin] FAIL NEXT_PUBLIC_APP_URL must be an absolute URL');
    return false;
  }
}

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function checkSource(label: string, file: string, pattern: RegExp): boolean {
  const source = readSource(file);
  const ok = pattern.test(source);
  console.log(`[source] ${ok ? 'OK' : 'FAIL'} ${label}`);
  return ok;
}

function main() {
  const envArgIndex = process.argv.indexOf('--env-file');
  const envFile = envArgIndex >= 0
    ? resolve(process.cwd(), process.argv[envArgIndex + 1] ?? '')
    : resolve(process.cwd(), '.env.local');
  const env = loadEnv(envFile);

  console.log('Toss live readiness check');
  console.log(`Env source: ${envFile} + process.env`);
  console.log('This check validates live-launch Toss env shape without printing secret values.');
  console.log('');

  let ok = true;

  ok = checkProductionOrigin(envValue(env, 'NEXT_PUBLIC_APP_URL')) && ok;
  ok = checkPrefix('TOSS_CLIENT_KEY', envValue(env, 'TOSS_CLIENT_KEY'), 'live_ck_') && ok;
  ok = checkPrefix('TOSS_SECRET_KEY', envValue(env, 'TOSS_SECRET_KEY'), 'live_sk_') && ok;
  ok = checkUnset('TOSS_PAYMENTS_CLIENT_KEY legacy alias', envValue(env, 'TOSS_PAYMENTS_CLIENT_KEY')) && ok;
  ok = checkUnset('TOSS_PAYMENTS_SECRET_KEY legacy alias', envValue(env, 'TOSS_PAYMENTS_SECRET_KEY')) && ok;

  console.log('');
  ok = checkSource(
    'Feature pay sheet sends successUrl to same-origin feature confirm route',
    'src/components/payments/feature-pay-sheet.tsx',
    /successUrl\s*=[\s\S]{0,200}`\$\{origin\}\/api\/payments\/feature\/confirm/,
  ) && ok;
  ok = checkSource(
    'Feature pay sheet sends failUrl to same-origin fail page',
    'src/components/payments/feature-pay-sheet.tsx',
    /failUrl:\s*`\$\{origin\}\/payments\/fail`/,
  ) && ok;
  ok = checkSource(
    'Feature confirm route redirects using request origin and allowlisted app paths',
    'src/app/api/payments/feature/confirm/route.ts',
    /request\.nextUrl\.origin[\s\S]*hapcard\|whatif/,
  ) && ok;

  console.log('');
  console.log('Manual Toss dashboard checks still required:');
  console.log('- Toss live payment methods and business settings are approved.');
  console.log('- Allowed success/fail URLs match NEXT_PUBLIC_APP_URL.');
  console.log('- Live payment success/fail/cancel smoke is run on the production domain.');

  if (!ok) {
    console.error('\nToss live readiness FAIL');
    process.exit(1);
  }

  console.log('\nToss live readiness PASS');
}

main();
