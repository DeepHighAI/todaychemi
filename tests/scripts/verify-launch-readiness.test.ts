import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../scripts/verify-launch-readiness.ts', import.meta.url),
  'utf8',
);

function gateBlock(name: string): string {
  const start = source.indexOf(`name: '${name}'`);
  expect(start).toBeGreaterThanOrEqual(0);

  const end = source.indexOf('  },', start);
  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
}

describe('verify-launch-readiness gate definition', () => {
  it('keeps launch-required quality, migration, and E2E commands in the integrated gate', () => {
    const requiredGates = [
      {
        name: 'TypeScript check',
        command: "command: [PNPM, 'tsc', '--noEmit']",
        timeout: '180_000',
      },
      {
        name: 'Launch audit artifact readiness',
        command: "command: [PNPM, 'verify:launch-audit-readiness']",
        timeout: null,
      },
      {
        name: 'External settings checklist readiness',
        command: "command: [PNPM, 'verify:external-settings-checklist']",
        timeout: null,
      },
      {
        name: 'Lint check',
        command: "command: [PNPM, 'lint']",
        timeout: '180_000',
      },
      {
        name: 'Unit test suite',
        command: "command: [PNPM, 'vitest', 'run']",
        timeout: '720_000',
      },
      {
        name: 'Production build',
        command: "command: [PNPM, 'build']",
        timeout: '300_000',
      },
      {
        name: 'Supabase migration dry-run',
        command: "command: [PNPM, 'db:push:dry']",
        timeout: '180_000',
      },
      {
        name: 'Public E2E readiness',
        command: "command: [PNPM, 'e2e']",
        timeout: '300_000',
      },
      {
        name: 'Auth E2E readiness',
        command: "command: [PNPM, 'e2e:auth']",
        timeout: '300_000',
      },
    ];

    for (const gate of requiredGates) {
      const block = gateBlock(gate.name);
      expect(block).toContain(gate.command);
      expect(block).toContain('required: true');
      if (gate.timeout) expect(block).toContain(`timeoutMs: ${gate.timeout}`);
    }
  });

  it('stores secret-free summary metadata instead of child command output', () => {
    expect(source).toContain('requiredFailures: requiredFailures.map((result) => result.gate.name)');
    expect(source).toContain('command: result.gate.command.join');
    expect(source).not.toContain('stdout: result.stdout');
    expect(source).not.toContain('stderr: result.stderr');
  });

  it('keeps the Windows runner shell-free for pnpm and cleans child process trees on timeout', () => {
    expect(source).toContain('const PNPM_CJS = getPnpmCjsPath()');
    expect(source).toContain("resolve(appData, 'npm/node_modules/pnpm/bin/pnpm.cjs')");
    expect(source).toContain('bin: process.execPath');
    expect(source).toContain('args: [PNPM_CJS, ...args]');
    expect(source).toContain('shell: false');
    expect(source).toContain("spawnSync('taskkill.exe'");
    expect(source).toContain("'/t'");
    expect(source).toContain("'/f'");
    expect(source).toContain('terminateProcessTree(child)');
  });

  it('runs launch gates sequentially so expensive checks do not compete for workers', () => {
    expect(source).toContain('const results: GateResult[] = []');
    expect(source).toContain('for (const gate of GATES)');
    expect(source).toContain('results.push(await runGate(gate))');
  });
});

const knownExternalSource = readFileSync(
  new URL('../../scripts/verify-known-external-blockers.ts', import.meta.url),
  'utf8',
);
const waitingStateSource = readFileSync(
  new URL('../../scripts/verify-launch-waiting-state.ts', import.meta.url),
  'utf8',
);

describe('verify-known-external-blockers helper', () => {
  it('locks the known external blocker set without changing launch gate semantics', () => {
    const expectedBlockers = [
      'launch env',
      'Auth readiness',
      'OpenAI/ZDR readiness',
      'Toss live readiness',
      'Vercel readiness',
      'Operations/E2E readiness',
      'External settings checklist readiness',
    ];

    for (const blocker of expectedBlockers) {
      expect(knownExternalSource).toContain(`'${blocker}'`);
    }
    expect(knownExternalSource).toContain('PASS here does not mean production can open');
    expect(knownExternalSource).toContain('known external dashboard/env/checklist evidence work');
    expect(knownExternalSource).toContain('The canonical Go/No-Go remains the launch readiness gate');
    expect(knownExternalSource).toContain("summary.verdict === 'FAIL'");
    expect(knownExternalSource).toContain('timedOut=true');
  });

  it('keeps the lightweight waiting-state helper tied to evidence and audit checks', () => {
    expect(waitingStateSource).toContain('verify:known-external-blockers');
    expect(waitingStateSource).toContain('verify:launch-audit-readiness');
    expect(waitingStateSource).toContain('verify:launch-evidence-readiness');
    expect(waitingStateSource).toContain('PASS does not mean production can open');
  });
});
