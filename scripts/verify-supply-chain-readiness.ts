import { spawnSync } from 'node:child_process';

interface AdvisoryFinding {
  version?: string;
  paths?: string[];
}

interface Advisory {
  module_name?: string;
  title?: string;
  severity?: 'info' | 'low' | 'moderate' | 'high' | 'critical';
  patched_versions?: string;
  url?: string;
  findings?: AdvisoryFinding[];
}

interface AuditJson {
  advisories?: Record<string, Advisory>;
  metadata?: {
    vulnerabilities?: Record<string, number>;
  };
}

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const FAIL_SEVERITIES = new Set(['critical', 'high']);

function parseAuditJson(stdout: string): AuditJson {
  try {
    return JSON.parse(stdout) as AuditJson;
  } catch (error) {
    throw new Error(`Unable to parse pnpm audit JSON: ${(error as Error).message}`);
  }
}

function main() {
  console.log('Supply-chain readiness check');
  console.log('This command runs pnpm audit --prod --json and fails launch on high/critical production advisories.');

  const audit = spawnSync(PNPM, ['audit', '--prod', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (audit.error) {
    console.error(`Unable to run pnpm audit: ${audit.error.message}`);
    process.exit(1);
  }

  if (!audit.stdout) {
    if (audit.stderr) process.stderr.write(audit.stderr);
    console.error('pnpm audit produced no JSON output.');
    process.exit(1);
  }

  const parsed = parseAuditJson(audit.stdout);
  const counts = parsed.metadata?.vulnerabilities ?? {};
  const advisories = Object.values(parsed.advisories ?? {});
  const launchBlocking = advisories.filter((advisory) => FAIL_SEVERITIES.has(advisory.severity ?? ''));

  console.log('');
  console.log('Production advisory counts:');
  for (const severity of ['critical', 'high', 'moderate', 'low', 'info']) {
    console.log(`- ${severity}: ${counts[severity] ?? 0}`);
  }

  if (launchBlocking.length > 0) {
    console.log('');
    console.log('Launch-blocking production advisories:');
    for (const advisory of launchBlocking) {
      const path = advisory.findings?.[0]?.paths?.[0] ?? '(path unavailable)';
      const patched = advisory.patched_versions ? `; patched ${advisory.patched_versions}` : '';
      console.log(`- [${advisory.severity}] ${advisory.module_name}: ${advisory.title}${patched}`);
      console.log(`  path: ${path}`);
      if (advisory.url) console.log(`  ${advisory.url}`);
    }
    console.error('\nSupply-chain readiness FAIL');
    process.exit(1);
  }

  if (advisories.length > 0) {
    console.log('');
    console.log('Non-blocking production advisories remain. Review before launch hardening sign-off.');
    for (const advisory of advisories.filter((item) => !FAIL_SEVERITIES.has(item.severity ?? ''))) {
      const path = advisory.findings?.[0]?.paths?.[0] ?? '(path unavailable)';
      const patched = advisory.patched_versions ? `; patched ${advisory.patched_versions}` : '';
      console.log(`- [${advisory.severity ?? 'unknown'}] ${advisory.module_name}: ${advisory.title}${patched}`);
      console.log(`  path: ${path}`);
      if (advisory.url) console.log(`  ${advisory.url}`);
    }
  }

  console.log('\nSupply-chain readiness PASS');
}

main();
