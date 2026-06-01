import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { isProductionOrigin } from './verify-launch-env';

const SUPABASE_CALLBACK = 'https://jamhkucluhiibqpjsiov.supabase.co/auth/v1/callback';

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

function readArg(name: string): string | null {
  const withEquals = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) return withEquals.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

function normalizeOriginInput(input: string): string {
  return input.trim();
}

function originFromEnv(envFile: string): string {
  const env = parseEnvFile(envFile);
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || env.get('NEXT_PUBLIC_APP_URL')?.trim() || '';
}

function describeOriginFailure(origin: string): string[] {
  const findings: string[] = [];

  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') findings.push('must use https');
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') findings.push('must not be localhost');
    if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
      findings.push('must be an origin without path, query, or hash');
    }
    if (origin.endsWith('/')) findings.push('must not have a trailing slash');
  } catch {
    findings.push('must be an absolute URL');
  }

  return findings;
}

function main() {
  const envFile = resolve(process.cwd(), readArg('--env-file') ?? '.env.local');
  const rawOrigin = readArg('--origin') ?? originFromEnv(envFile);
  const origin = normalizeOriginInput(rawOrigin);

  console.log('Production origin shape readiness check');
  console.log('Scope: public origin and derived dashboard URLs only; no secrets are read or printed.');

  if (!origin) {
    console.log('');
    console.log('[origin] FAIL NEXT_PUBLIC_APP_URL missing; pass --origin https://<project>.vercel.app or set the env value.');
    process.exit(1);
  }

  const ok = isProductionOrigin(origin);
  console.log('');
  console.log(`[origin] ${ok ? 'OK' : 'FAIL'} production origin shape`);

  if (!ok) {
    for (const finding of describeOriginFailure(rawOrigin.trim())) console.log(`- ${finding}`);
    process.exit(1);
  }

  console.log('');
  console.log('Derived dashboard values:');
  console.log(`- NEXT_PUBLIC_APP_URL: ${origin}`);
  console.log(`- Supabase Site URL: ${origin}`);
  console.log(`- Supabase Redirect URL: ${origin}/auth/callback`);
  console.log(`- Google/Kakao Web origin: ${origin}`);
  console.log(`- Google/Kakao OAuth callback: ${SUPABASE_CALLBACK}`);
  console.log(`- Toss Success URL: ${origin}/api/payments/confirm`);
  console.log(`- Toss Fail/Cancel URL: ${origin}/payments/fail`);

  if (new URL(origin).hostname.endsWith('.vercel.app')) {
    console.log('');
    console.log('MVP no-custom-domain policy: OK, this is a Vercel *.vercel.app origin.');
  }

  console.log('');
  console.log('Production origin shape readiness PASS');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
