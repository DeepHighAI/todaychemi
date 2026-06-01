import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface VercelProjectConfig {
  orgId?: unknown;
  projectId?: unknown;
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

function loadEnv(envFile: string): Map<string, string> {
  const env = parseEnvFile(envFile);
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && value.length > 0) env.set(key, value);
  }
  return env;
}

function readVercelProjectConfig(path: string): VercelProjectConfig | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as VercelProjectConfig;
  } catch (err) {
    console.log(`[vercel link] FAIL invalid ${path}: ${(err as Error).message}`);
    return {};
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function checkProductionOrigin(origin: string | undefined): boolean {
  if (!origin) {
    console.log('[production origin] FAIL NEXT_PUBLIC_APP_URL missing');
    return false;
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    console.log('[production origin] FAIL NEXT_PUBLIC_APP_URL must be an absolute URL');
    return false;
  }

  if (url.protocol !== 'https:') {
    console.log('[production origin] FAIL NEXT_PUBLIC_APP_URL must use https');
    return false;
  }
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    console.log('[production origin] FAIL NEXT_PUBLIC_APP_URL must not be localhost');
    return false;
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    console.log('[production origin] FAIL NEXT_PUBLIC_APP_URL must be an origin without path, query, or hash');
    return false;
  }
  if (origin.endsWith('/')) {
    console.log('[production origin] FAIL NEXT_PUBLIC_APP_URL must not have a trailing slash');
    return false;
  }

  console.log(`[production origin] OK ${url.origin}`);
  return true;
}

function main() {
  const envArgIndex = process.argv.indexOf('--env-file');
  const envFile = envArgIndex >= 0
    ? resolve(process.cwd(), process.argv[envArgIndex + 1] ?? '')
    : resolve(process.cwd(), '.env.local');
  const env = loadEnv(envFile);
  const projectPath = resolve(process.cwd(), '.vercel/project.json');

  let ok = true;

  console.log('Vercel readiness check');
  console.log(`Env source: ${envFile} + process.env`);
  console.log('');

  if (!existsSync(resolve(process.cwd(), 'next.config.ts'))) {
    console.log('[next config] FAIL next.config.ts missing');
    ok = false;
  } else {
    console.log('[next config] OK next.config.ts');
  }

  const config = readVercelProjectConfig(projectPath);
  if (!config) {
    console.log('[vercel link] FAIL .vercel/project.json missing; run Vercel project link/create before launch');
    ok = false;
  } else {
    const orgOk = isNonEmptyString(config.orgId);
    const projectOk = isNonEmptyString(config.projectId);
    console.log(`[vercel link] ${orgOk ? 'OK' : 'FAIL'} orgId`);
    console.log(`[vercel link] ${projectOk ? 'OK' : 'FAIL'} projectId`);
    ok = orgOk && projectOk && ok;
  }

  ok = checkProductionOrigin(env.get('NEXT_PUBLIC_APP_URL')) && ok;

  const vercelProductionUrl = env.get('VERCEL_PROJECT_PRODUCTION_URL')?.trim();
  if (vercelProductionUrl) {
    console.log(`[vercel fallback origin] OK VERCEL_PROJECT_PRODUCTION_URL=${vercelProductionUrl}`);
  } else {
    console.log('[vercel fallback origin] INFO VERCEL_PROJECT_PRODUCTION_URL not set locally; Vercel injects this at runtime');
  }

  console.log('');
  console.log('Manual Vercel checks still required:');
  console.log('- Production and Preview env vars are configured from .env.example.');
  console.log('- Production origin points to the Vercel project and is the value of NEXT_PUBLIC_APP_URL.');
  console.log('- Latest production deployment was built from the intended branch/commit.');
  console.log('- Deployment protection, logs, and rollback access are verified in the Vercel dashboard.');

  if (!ok) {
    console.error('\nVercel readiness FAIL');
    process.exit(1);
  }

  console.log('\nVercel readiness PASS');
}

main();
