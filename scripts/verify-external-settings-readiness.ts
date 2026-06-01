import { spawnSync } from 'node:child_process';

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const EXTERNAL_SETTING_GATES = [
  'verify:launch-env',
  'verify:auth-readiness',
  'verify:openai-readiness',
  'verify:toss-live-readiness',
  'verify:vercel-readiness',
  'verify:ops-readiness',
  'verify:external-settings-checklist',
] as const;

function runGate(scriptName: string): boolean {
  console.log('');
  console.log(`=== ${scriptName} ===`);
  console.log(`$ ${PNPM} ${scriptName}`);

  const result = spawnSync(PNPM, [scriptName], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(`[${scriptName}] ${result.error.message}`);

  const ok = result.status === 0;
  console.log(`--- ${scriptName}: ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

function main() {
  console.log('External settings readiness check');
  console.log('This runs only the gates that depend on provider dashboards, production env, live integration setup, or operator evidence.');
  console.log('PASS here is not sufficient for launch; follow with pnpm verify:launch-readiness and production evidence.');

  const results = EXTERNAL_SETTING_GATES.map((gate) => ({
    gate,
    ok: runGate(gate),
  }));
  const failures = results.filter((result) => !result.ok);

  console.log('');
  console.log('=== Summary ===');
  for (const result of results) {
    console.log(`[${result.ok ? 'PASS' : 'FAIL'}] ${result.gate}`);
  }

  console.log('');
  console.log('Next step:');
  if (failures.length > 0) {
    console.log('- Keep configuring the failing dashboard/env/checklist evidence items, then re-run this command.');
    console.log('- MVP does not require a custom domain. Use the fixed Vercel Production *.vercel.app origin for NEXT_PUBLIC_APP_URL and dashboard redirects.');
    console.log('- Guide: docs/runbooks/external_launch_settings.md');
    console.log('- Checklist: docs/qa/external_settings_checklist.md');
    console.log('- After these pass, use evidence template: docs/qa/launch_evidence_template.md');
  } else {
    console.log('- Run pnpm verify:launch-readiness, then generate and verify production launch evidence.');
    console.log('- Evidence template: docs/qa/launch_evidence_template.md');
  }

  if (failures.length > 0) {
    console.error('\nExternal settings readiness FAIL');
    process.exit(1);
  }

  console.log('\nExternal settings readiness PASS');
}

main();
