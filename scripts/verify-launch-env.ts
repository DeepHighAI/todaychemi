import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Severity = 'required' | 'recommended';

export interface EnvCheck {
  key: string;
  severity: Severity;
  purpose: string;
  note?: string;
}

export const LAUNCH_ENV_CHECKS: EnvCheck[] = [
  {
    key: 'NEXT_PUBLIC_APP_URL',
    severity: 'required',
    purpose: 'Production absolute app origin for auth, legal callbacks, share, and OG URLs',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    severity: 'required',
    purpose: 'Supabase browser/server project URL',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    severity: 'required',
    purpose: 'Supabase browser anon key',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    severity: 'required',
    purpose: 'Server-only Supabase service role key for protected writes/RPCs',
  },
  {
    key: 'OPENAI_API_KEY',
    severity: 'required',
    purpose: 'OpenAI API access for hapcard, replay, whatif, and today flows',
  },
  {
    key: 'OPENAI_PROJECT_ID',
    severity: 'required',
    purpose: 'OpenAI ZDR project routing evidence',
  },
  {
    key: 'KASI_SERVICE_KEY',
    severity: 'required',
    purpose: 'KASI manseryeok API key used by current route handlers/scripts',
  },
  {
    key: 'TOSS_CLIENT_KEY',
    severity: 'required',
    purpose: 'TossPayments V2 widget client key',
    note: 'Legacy TOSS_PAYMENTS_CLIENT_KEY is accepted by code but should not be the launch source of truth.',
  },
  {
    key: 'TOSS_SECRET_KEY',
    severity: 'required',
    purpose: 'TossPayments V2 server confirm/query secret',
    note: 'Legacy TOSS_PAYMENTS_SECRET_KEY is accepted by code but should not be the launch source of truth.',
  },
  {
    key: 'NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY',
    severity: 'required',
    purpose: 'KakaoTalk Share browser SDK key',
  },
  {
    key: 'KAKAO_ADMIN_KEY',
    severity: 'required',
    purpose: 'KakaoTalk Share callback verification key',
  },
  {
    key: 'LLM_DAILY_BUDGET_USD',
    severity: 'required',
    purpose: 'Daily LLM cost guardrail',
  },
  {
    key: 'ANTHROPIC_API_KEY',
    severity: 'required',
    purpose: 'Anthropic Claude fallback readiness',
  },
  {
    key: 'SENTRY_DSN',
    severity: 'required',
    purpose: 'Server-side Sentry error monitoring',
  },
  {
    key: 'NEXT_PUBLIC_SENTRY_DSN',
    severity: 'required',
    purpose: 'Browser Sentry error monitoring',
  },
];

const MANUAL_CHECKS = [
  'Vercel project is linked and production/preview environments contain the required keys.',
  'Supabase Auth Site URL and redirect URLs include the production origin.',
  'Supabase Google/Kakao OAuth providers are enabled in the dashboard.',
  'Supabase leaked-password protection decision is applied in the dashboard.',
  'Toss dashboard live keys, business settings, and success/fail URLs are configured.',
  'OpenAI account/project has the required ZDR status for production traffic.',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

function loadEnvSources(envFile: string): Map<string, string> {
  const env = parseEnvFile(envFile);
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && value.length > 0) env.set(key, value);
  }
  return env;
}

function isPresent(env: Map<string, string>, key: string): boolean {
  return (env.get(key) ?? '').trim().length > 0;
}

function checkWhenPresent(
  env: Map<string, string>,
  key: string,
  label: string,
  validate: (value: string) => boolean,
): boolean {
  const value = env.get(key)?.trim() ?? '';
  if (!value) {
    console.log(`[shape] SKIP ${key} - missing`);
    return true;
  }

  const ok = validate(value);
  console.log(`[shape] ${ok ? 'OK' : 'FAIL'} ${label}`);
  return ok;
}

function checkUnset(env: Map<string, string>, key: string, label: string): boolean {
  const ok = (env.get(key) ?? '').trim().length === 0;
  console.log(`[shape] ${ok ? 'OK' : 'FAIL'} ${label}`);
  return ok;
}

export function isProductionOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname !== 'localhost'
      && url.hostname !== '127.0.0.1'
      && url.pathname === '/'
      && url.search === ''
      && url.hash === ''
      && !value.endsWith('/');
  } catch {
    return false;
  }
}

function isPositiveNumber(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function checkValueShapes(env: Map<string, string>): boolean {
  console.log('');
  console.log('Value shape checks:');

  let ok = true;
  ok = checkWhenPresent(
    env,
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_APP_URL is https production origin without trailing slash',
    isProductionOrigin,
  ) && ok;
  ok = checkWhenPresent(
    env,
    'OPENAI_PROJECT_ID',
    'OPENAI_PROJECT_ID uses proj_* format',
    (value) => /^proj_[A-Za-z0-9]+$/.test(value),
  ) && ok;
  ok = checkWhenPresent(
    env,
    'TOSS_CLIENT_KEY',
    'TOSS_CLIENT_KEY uses live_gck_* prefix',
    (value) => value.startsWith('live_gck_'),
  ) && ok;
  ok = checkWhenPresent(
    env,
    'TOSS_SECRET_KEY',
    'TOSS_SECRET_KEY uses live_gsk_* prefix',
    (value) => value.startsWith('live_gsk_'),
  ) && ok;
  ok = checkWhenPresent(
    env,
    'LLM_DAILY_BUDGET_USD',
    'LLM_DAILY_BUDGET_USD is a positive number',
    isPositiveNumber,
  ) && ok;
  ok = checkUnset(
    env,
    'TOSS_PAYMENTS_CLIENT_KEY',
    'TOSS_PAYMENTS_CLIENT_KEY legacy alias is unset',
  ) && ok;
  ok = checkUnset(
    env,
    'TOSS_PAYMENTS_SECRET_KEY',
    'TOSS_PAYMENTS_SECRET_KEY legacy alias is unset',
  ) && ok;

  return ok;
}

function checkCatalogs(checks: EnvCheck[]): boolean {
  const envExamplePath = resolve(process.cwd(), '.env.example');
  const secretsCatalogPath = resolve(process.cwd(), 'docs/specs/secrets.md');
  const envExample = parseEnvFile(envExamplePath);
  const secretsCatalog = existsSync(secretsCatalogPath)
    ? readFileSync(secretsCatalogPath, 'utf8')
    : '';

  let ok = true;

  console.log('');
  console.log('Catalog drift checks:');

  for (const check of checks) {
    const inExample = envExample.has(check.key);
    const inSecrets = new RegExp(`\`${escapeRegExp(check.key)}\``).test(secretsCatalog);
    console.log(`[catalog] ${inExample ? 'OK' : 'FAIL'} .env.example includes ${check.key}`);
    console.log(`[catalog] ${inSecrets ? 'OK' : 'FAIL'} docs/specs/secrets.md includes ${check.key}`);
    ok = inExample && inSecrets && ok;
  }

  return ok;
}

function main() {
  const envArgIndex = process.argv.indexOf('--env-file');
  const envFile = envArgIndex >= 0
    ? resolve(process.cwd(), process.argv[envArgIndex + 1] ?? '')
    : resolve(process.cwd(), '.env.local');
  const env = loadEnvSources(envFile);

  const missingRequired: EnvCheck[] = [];
  const missingRecommended: EnvCheck[] = [];

  console.log(`Launch env readiness check`);
  console.log(`Source: ${envFile} + process.env`);
  console.log('');

  for (const check of LAUNCH_ENV_CHECKS) {
    const present = isPresent(env, check.key);
    const icon = present ? 'OK' : check.severity === 'required' ? 'MISSING' : 'WARN';
    console.log(`[${icon}] ${check.key} - ${check.purpose}`);
    if (check.note) console.log(`      ${check.note}`);

    if (!present && check.severity === 'required') missingRequired.push(check);
    if (!present && check.severity === 'recommended') missingRecommended.push(check);
  }

  const shapesOk = checkValueShapes(env);
  const catalogsOk = checkCatalogs(LAUNCH_ENV_CHECKS);

  console.log('');
  console.log('Manual dashboard checks:');
  for (const item of MANUAL_CHECKS) console.log(`- ${item}`);

  console.log('');
  console.log(`Summary: ${missingRequired.length} required missing, ${missingRecommended.length} recommended missing`);

  if (missingRequired.length > 0 || !shapesOk || !catalogsOk) {
    console.log('');
    if (!shapesOk) console.log('Env value shape issue detected. Check launch env formatting and legacy aliases.');
    if (!catalogsOk) console.log('Env catalog drift detected. Update .env.example and docs/specs/secrets.md.');
    console.log('Missing required keys:');
    for (const check of missingRequired) console.log(`- ${check.key}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
