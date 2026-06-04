import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface FileCheck {
  path: string;
  label: string;
  pattern?: RegExp;
}

const REQUIRED_ENV = [
  'SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_DSN',
  'LLM_DAILY_BUDGET_USD',
  'ANTHROPIC_API_KEY',
];

const FILE_CHECKS: FileCheck[] = [
  {
    path: 'src/instrumentation.ts',
    label: 'Next instrumentation hooks Sentry request errors',
    pattern: /captureRequestError/,
  },
  {
    path: 'src/instrumentation-client.ts',
    label: 'Browser Sentry disables default PII',
    pattern: /sendDefaultPii:\s*false/,
  },
  {
    path: 'src/sentry.server.config.ts',
    label: 'Server Sentry disables default PII',
    pattern: /sendDefaultPii:\s*false/,
  },
  {
    path: 'src/sentry.edge.config.ts',
    label: 'Edge Sentry disables default PII',
    pattern: /sendDefaultPii:\s*false/,
  },
  {
    path: 'docs/runbooks/launch_opening.md',
    label: 'Launch opening runbook exists',
    pattern: /pnpm verify:launch-readiness[\s\S]*pnpm e2e -- --base-url[\s\S]*pnpm e2e:auth -- --base-url[\s\S]*롤백/,
  },
  {
    path: 'docs/qa/launch_evidence_template.md',
    label: 'Launch evidence template exists',
    pattern: /PII[\s\S]*create:launch-evidence[\s\S]*Go\/No-Go[\s\S]*Payment Ledger Evidence/,
  },
  {
    path: 'docs/qa/external_settings_checklist.md',
    label: 'External settings checklist exists',
    pattern: /External Settings Checklist(?=[\s\S]*secret-free)[\s\S]*Production Origin[\s\S]*Vercel Environment Variables[\s\S]*Supabase Auth[\s\S]*OpenAI \/ ZDR[\s\S]*Toss Payments[\s\S]*Sentry \/ Operations/,
  },
  {
    path: 'scripts/create-launch-evidence.ts',
    label: 'Launch evidence generator exists',
    pattern: /Cannot auto-generate 서비스 오픈 가능 evidence[\s\S]*renderEvidence[\s\S]*Payment Ledger Evidence[\s\S]*pathToFileURL/,
  },
  {
    path: 'scripts/verify-launch-evidence-readiness.ts',
    label: 'Launch evidence scanner exists',
    pattern: /scanLaunchEvidence[\s\S]*Launch evidence readiness PASS/,
  },
  {
    path: 'docs/qa/launch_p0_approval_packet.md',
    label: 'Launch P0 approval packet exists',
    pattern: /D1 - Supabase Payment[\s\S]*D8 - Production Dependency[\s\S]*pnpm verify:launch-readiness/,
  },
  {
    path: 'docs/runbooks/release_canary.md',
    label: 'Release canary runbook exists',
  },
  {
    path: 'docs/runbooks/incident_template.md',
    label: 'Incident template exists',
  },
  {
    path: 'docs/runbooks/openai_outage.md',
    label: 'OpenAI outage runbook exists',
  },
  {
    path: 'docs/runbooks/supabase_outage.md',
    label: 'Supabase outage runbook exists',
  },
  {
    path: 'docs/runbooks/vercel_outage.md',
    label: 'Vercel outage runbook exists',
  },
  {
    path: 'docs/qa/local_e2e_smoke.md',
    label: 'Manual local E2E smoke guide exists',
  },
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

function checkEnv(env: Map<string, string>): boolean {
  let ok = true;
  for (const key of REQUIRED_ENV) {
    const present = (env.get(key) ?? '').trim().length > 0;
    console.log(`[env] ${present ? 'OK' : 'FAIL'} ${key}`);
    ok = present && ok;
  }
  return ok;
}

function checkFile(check: FileCheck): boolean {
  const fullPath = resolve(process.cwd(), check.path);
  if (!existsSync(fullPath)) {
    console.log(`[file] FAIL ${check.label} - missing ${check.path}`);
    return false;
  }

  if (!check.pattern) {
    console.log(`[file] OK ${check.label}`);
    return true;
  }

  const source = readFileSync(fullPath, 'utf8');
  const ok = check.pattern.test(source);
  console.log(`[file] ${ok ? 'OK' : 'FAIL'} ${check.label}`);
  return ok;
}

function checkPlaywrightAutomation(): boolean {
  const configExists = [
    'playwright.config.ts',
    'playwright.config.mts',
    'playwright.config.js',
    'playwright.config.cjs',
  ].some((file) => existsSync(resolve(process.cwd(), file)));

  const e2eDir = resolve(process.cwd(), 'tests/e2e');
  const hasE2eTests = existsSync(e2eDir)
    && readdirSync(e2eDir, { recursive: true }).some((entry) => /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(String(entry)));

  console.log(`[e2e] ${configExists ? 'OK' : 'FAIL'} Playwright config`);
  console.log(`[e2e] ${hasE2eTests ? 'OK' : 'FAIL'} tests/e2e automated specs`);

  return configExists && hasE2eTests;
}

function checkPackageScripts(): boolean {
  const packagePath = resolve(process.cwd(), 'package.json');
  if (!existsSync(packagePath)) {
    console.log('[e2e] FAIL package.json missing');
    return false;
  }

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const e2eScript = packageJson.scripts?.e2e;
  const authScript = packageJson.scripts?.['e2e:auth'];
  const evidenceScript = packageJson.scripts?.['create:launch-evidence'];
  const evidenceReadinessScript = packageJson.scripts?.['verify:launch-evidence-readiness'];
  const e2eOk = typeof e2eScript === 'string' && e2eScript.includes('run-e2e');
  const authOk = typeof authScript === 'string' && authScript.includes('run-e2e') && authScript.includes('@auth');
  const evidenceOk = typeof evidenceScript === 'string' && evidenceScript.includes('create-launch-evidence');
  const evidenceReadinessOk = typeof evidenceReadinessScript === 'string'
    && evidenceReadinessScript.includes('verify-launch-evidence-readiness');

  console.log(`[e2e] ${e2eOk ? 'OK' : 'FAIL'} pnpm e2e script`);
  console.log(`[e2e] ${authOk ? 'OK' : 'FAIL'} pnpm e2e:auth script`);
  console.log(`[evidence] ${evidenceOk ? 'OK' : 'FAIL'} pnpm create:launch-evidence script`);
  console.log(`[evidence] ${evidenceReadinessOk ? 'OK' : 'FAIL'} pnpm verify:launch-evidence-readiness script`);
  return e2eOk && authOk && evidenceOk && evidenceReadinessOk;
}

function main() {
  const envArgIndex = process.argv.indexOf('--env-file');
  const envFile = envArgIndex >= 0
    ? resolve(process.cwd(), process.argv[envArgIndex + 1] ?? '')
    : resolve(process.cwd(), '.env.local');
  const env = loadEnv(envFile);

  console.log('Operations readiness check');
  console.log(`Env source: ${envFile} + process.env`);
  console.log('');

  let ok = checkEnv(env);
  for (const check of FILE_CHECKS) ok = checkFile(check) && ok;
  ok = checkPackageScripts() && ok;
  ok = checkPlaywrightAutomation() && ok;

  console.log('');
  console.log('Manual checks still required:');
  console.log('- Sentry project DSNs are configured in Vercel production and preview.');
  console.log('- Alerts exist for payment confirm failures, LLM failures/rate limits, and 5xx spikes.');
  console.log('- Production canary is run after deploy and recorded with evidence.');
  console.log('- Production E2E smoke covers signup/login, onboarding, relation, feed, hapcard, replay, whatif, today, me, pay-per-use feature payment/use/refund.');

  if (!ok) {
    console.error('\nOperations readiness FAIL');
    process.exit(1);
  }

  console.log('\nOperations readiness PASS');
}

main();
