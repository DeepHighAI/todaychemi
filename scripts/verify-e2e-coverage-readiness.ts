import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

interface FlowRequirement {
  id: string;
  label: string;
  patterns: RegExp[];
}

const ROOT = process.cwd();
const PLAYWRIGHT_CONFIG = path.join(ROOT, 'playwright.config.ts');
const E2E_RUNNER = path.join(ROOT, 'scripts', 'run-e2e.ts');
const E2E_DIR = path.join(ROOT, 'tests', 'e2e');

const REQUIRED_FLOWS: FlowRequirement[] = [
  {
    id: 'public_shell',
    label: 'public shell, legal pages, and login-gated protected route smoke',
    patterns: [/\/start/, /\/login/, /\/signup/, /\/legal\/privacy/, /\/legal\/refund/, /\/payments\/charge/],
  },
  {
    id: 'signup_login',
    label: 'signup and login happy-path smoke',
    patterns: [/@auth/, /\/signup/i, /\/login/i, /email/i, /password/i, /\/api\/me/],
  },
  {
    id: 'onboarding',
    label: 'onboarding completion smoke',
    patterns: [/onboarding/i],
  },
  {
    id: 'relation_create',
    label: 'relation create smoke',
    patterns: [/relations\/new/i, /relation/i],
  },
  {
    id: 'feed',
    label: 'feed smoke',
    patterns: [/\/feed/i],
  },
  {
    id: 'hapcard',
    label: 'hapcard creation/view smoke',
    patterns: [/hapcard/i],
  },
  {
    id: 'replay',
    label: 'replay paid-use/refund smoke',
    patterns: [/replay/i],
  },
  {
    id: 'whatif',
    label: 'whatif smoke',
    patterns: [/whatif/i],
  },
  {
    id: 'today',
    label: 'today home smoke',
    patterns: [/today/i, /오늘/],
  },
  {
    id: 'me',
    label: 'me/profile/wallet smoke',
    patterns: [/page\.goto\('\/me'\)|toHaveURL\(\/\\\/me\$\//, /wallet/i],
  },
  {
    id: 'paid_charge',
    label: 'paid charge success/fail/cancel smoke',
    patterns: [/payments\/charge/i, /payments\/success/i, /payments\/fail/i],
  },
  {
    id: 'paid_use_refund',
    label: 'paid token spend and refund/idempotency smoke',
    patterns: [/deduct_tokens/i, /refund_tokens/i, /idempot/i],
  },
  {
    id: 'og_share_401_404',
    label: 'OG/share plus 401/404 error-path smoke',
    patterns: [/\/api\/og/i, /share/i, /401/, /404/],
  },
  {
    id: 'payment_internal_error_ux',
    label: 'payment internal-error failure UX smoke',
    patterns: [/\/payments\/fail/i, /INTERNAL_ERROR/, /500 internal error/i],
  },
  {
    id: 'server_500_error_path',
    label: '500/internal-error path smoke',
    patterns: [/toBe\(500\)/, /INTERNAL_ERROR|internal error/i],
  },
];

function collectFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (/\.(spec|test)\.ts$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function readOptional(filePath: string): string {
  if (!existsSync(filePath)) return '';
  return readFileSync(filePath, 'utf8');
}

function includesAll(text: string, patterns: RegExp[]): boolean {
  return patterns.every((pattern) => pattern.test(text));
}

function checkInfrastructure(specFiles: string[]): CheckResult[] {
  const config = readOptional(PLAYWRIGHT_CONFIG);
  const runner = readOptional(E2E_RUNNER);

  return [
    {
      name: 'Playwright config exists',
      ok: config.length > 0,
      detail: path.relative(ROOT, PLAYWRIGHT_CONFIG),
    },
    {
      name: 'Desktop and mobile projects configured',
      ok: /chromium-desktop/.test(config) && /mobile-chrome/.test(config),
      detail: 'Expected chromium-desktop and mobile-chrome projects.',
    },
    {
      name: 'Runtime error artifacts configured',
      ok: /trace:\s*'(on-first-retry|retain-on-failure)'/.test(config) && /screenshot:\s*'only-on-failure'/.test(config),
      detail: 'Expected retained traces and failure screenshots for launch debugging.',
    },
    {
      name: 'E2E runner starts local Next server',
      ok: /next/.test(runner) && /dev/.test(runner) && /playwright/.test(runner),
      detail: path.relative(ROOT, E2E_RUNNER),
    },
    {
      name: 'E2E specs exist',
      ok: specFiles.length > 0,
      detail: specFiles.length === 0 ? 'No tests/e2e specs found.' : `${specFiles.length} spec file(s) found.`,
    },
  ];
}

function checkFlowCoverage(specFiles: string[]): CheckResult[] {
  const combinedSpecs = specFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

  return REQUIRED_FLOWS.map((flow) => ({
    name: `Core E2E flow: ${flow.id}`,
    ok: includesAll(combinedSpecs, flow.patterns),
    detail: flow.label,
  }));
}

function printResults(title: string, results: CheckResult[]) {
  console.log('');
  console.log(`=== ${title} ===`);
  for (const result of results) {
    const marker = result.ok ? 'PASS' : 'FAIL';
    console.log(`[${marker}] ${result.name} - ${result.detail}`);
  }
}

function main() {
  console.log('E2E coverage readiness');
  console.log('This check is static. It verifies launch-critical flow coverage exists before relying on browser smoke results.');

  const specFiles = collectFiles(E2E_DIR);
  const infrastructure = checkInfrastructure(specFiles);
  const flowCoverage = checkFlowCoverage(specFiles);
  const allResults = [...infrastructure, ...flowCoverage];
  const failures = allResults.filter((result) => !result.ok);

  printResults('Infrastructure', infrastructure);
  printResults('Core Flow Coverage', flowCoverage);

  if (failures.length > 0) {
    console.log('');
    console.log('Missing launch E2E evidence:');
    for (const failure of failures) {
      console.log(`- ${failure.name}: ${failure.detail}`);
    }
    console.error('\nE2E coverage readiness FAIL');
    process.exit(1);
  }

  console.log('\nE2E coverage readiness PASS');
}

main();
