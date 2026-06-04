import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

interface Gate {
  name: string;
  command: string[];
  required: boolean;
  timeoutMs?: number;
}

interface GateResult {
  gate: Gate;
  status: 'pass' | 'fail';
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  errorMessage?: string;
}

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const DEFAULT_GATE_TIMEOUT_MS = 120_000;
const PNPM_CJS = getPnpmCjsPath();

const GATES: Gate[] = [
  {
    name: 'launch env',
    command: [PNPM, 'verify:launch-env'],
    required: true,
  },
  {
    name: 'Secret/public env boundary readiness',
    command: [PNPM, 'verify:secret-boundary-readiness'],
    required: true,
  },
  {
    name: 'Launch audit artifact readiness',
    command: [PNPM, 'verify:launch-audit-readiness'],
    required: true,
  },
  {
    name: 'External settings checklist readiness',
    command: [PNPM, 'verify:external-settings-checklist'],
    required: true,
  },
  {
    name: 'TypeScript check',
    command: [PNPM, 'tsc', '--noEmit'],
    required: true,
    timeoutMs: 180_000,
  },
  {
    name: 'Lint check',
    command: [PNPM, 'lint'],
    required: true,
    timeoutMs: 180_000,
  },
  {
    name: 'Unit test suite',
    command: [PNPM, 'vitest', 'run'],
    required: true,
    timeoutMs: 720_000,
  },
  {
    name: 'Production build',
    command: [PNPM, 'build'],
    required: true,
    timeoutMs: 300_000,
  },
  {
    name: 'Auth readiness',
    command: [PNPM, 'verify:auth-readiness'],
    required: true,
  },
  {
    name: 'OpenAI/ZDR readiness',
    command: [PNPM, 'verify:openai-readiness'],
    required: true,
  },
  {
    name: 'LLM/score boundary readiness',
    command: [PNPM, 'verify:llm-boundary-readiness'],
    required: true,
  },
  {
    name: 'LLM resilience readiness',
    command: [PNPM, 'verify:llm-resilience-readiness'],
    required: true,
  },
  {
    name: 'payment DB readiness',
    command: [PNPM, 'verify:payment-readiness'],
    required: true,
  },
  {
    name: 'payment flow readiness',
    command: [PNPM, 'verify:payment-flow-readiness'],
    required: true,
  },
  {
    name: 'Toss live readiness',
    command: [PNPM, 'verify:toss-live-readiness'],
    required: true,
  },
  {
    name: 'billing policy readiness',
    command: [PNPM, 'verify:billing-policy-readiness'],
    required: true,
  },
  {
    name: 'DB/RLS readiness',
    command: [PNPM, 'verify:db-rls-readiness'],
    required: true,
    timeoutMs: 180_000,
  },
  {
    name: 'Supabase migration dry-run',
    command: [PNPM, 'db:push:dry'],
    required: true,
    timeoutMs: 180_000,
  },
  {
    name: 'Supabase RPC security readiness',
    command: [PNPM, 'verify:supabase-security-readiness'],
    required: true,
  },
  {
    name: 'Vercel readiness',
    command: [PNPM, 'verify:vercel-readiness'],
    required: true,
  },
  {
    name: 'Operations/E2E readiness',
    command: [PNPM, 'verify:ops-readiness'],
    required: true,
  },
  {
    name: 'Supply-chain readiness',
    command: [PNPM, 'verify:supply-chain-readiness'],
    required: true,
    timeoutMs: 180_000,
  },
  {
    name: 'Public E2E readiness',
    command: [PNPM, 'e2e'],
    required: true,
    timeoutMs: 300_000,
  },
  {
    name: 'Auth E2E readiness',
    command: [PNPM, 'e2e:auth'],
    required: true,
    timeoutMs: 300_000,
  },
  {
    name: 'Core E2E coverage readiness',
    command: [PNPM, 'verify:e2e-coverage-readiness'],
    required: true,
  },
];

function getPnpmCjsPath(): string | null {
  if (process.platform !== 'win32') return null;

  const appData = process.env.APPDATA;
  if (!appData) return null;

  const candidate = resolve(appData, 'npm/node_modules/pnpm/bin/pnpm.cjs');
  return existsSync(candidate) ? candidate : null;
}

function resolveGateCommand(command: string[]): {
  bin: string;
  args: string[];
  shell: boolean;
} {
  const [bin, ...args] = command;
  if (bin === PNPM && PNPM_CJS) {
    return {
      bin: process.execPath,
      args: [PNPM_CJS, ...args],
      shell: false,
    };
  }

  return {
    bin,
    args,
    shell: process.platform === 'win32',
  };
}

function terminateProcessTree(child: ChildProcessWithoutNullStreams) {
  if (!child.pid) return;

  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

function runGate(gate: Gate): Promise<GateResult> {
  console.log('');
  console.log(`=== ${gate.name} ===`);
  console.log(`$ ${gate.command.join(' ')}`);
  console.log(`timeout: ${Math.round((gate.timeoutMs ?? DEFAULT_GATE_TIMEOUT_MS) / 1000)}s`);

  const resolved = resolveGateCommand(gate.command);
  const startedAt = Date.now();
  const child = spawn(resolved.bin, resolved.args, {
    cwd: process.cwd(),
    shell: resolved.shell,
    windowsHide: true,
    detached: process.platform !== 'win32',
  });

  let stdout = '';
  let stderr = '';
  let errorMessage: string | undefined;
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    terminateProcessTree(child);
  }, gate.timeoutMs ?? DEFAULT_GATE_TIMEOUT_MS);

  child.stdout.on('data', (chunk: Buffer | string) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });
  child.on('error', (error) => {
    errorMessage = error.message;
  });

  return new Promise((resolveResult) => {
    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startedAt;

      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      if (errorMessage) {
        console.error(`[${gate.name}] ${errorMessage}`);
      }

      const status = exitCode === 0 ? 'pass' : 'fail';
      const suffix = timedOut
        ? ' (timed out)'
        : exitCode === null
          ? ' (no exit code)'
          : '';
      console.log(`--- ${gate.name}: ${status.toUpperCase()}${suffix}`);

      resolveResult({ gate, status, exitCode, timedOut, durationMs, errorMessage });
    });
  });
}

function getSummaryJsonPath(): string | null {
  const index = process.argv.indexOf('--summary-json');
  if (index === -1) return null;

  const rawPath = process.argv[index + 1];
  if (!rawPath || rawPath.startsWith('--')) {
    console.error('--summary-json requires a file path');
    process.exit(1);
  }

  return resolve(process.cwd(), rawPath);
}

function writeSummaryJson(path: string, results: GateResult[], requiredFailures: GateResult[]) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        cwd: process.cwd(),
        verdict: requiredFailures.length > 0 ? 'FAIL' : 'PASS',
        requiredFailures: requiredFailures.map((result) => result.gate.name),
        results: results.map((result) => ({
          name: result.gate.name,
          required: result.gate.required,
          status: result.status,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          durationMs: result.durationMs,
          timeoutMs: result.gate.timeoutMs ?? DEFAULT_GATE_TIMEOUT_MS,
          command: result.gate.command.join(' '),
        })),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`Launch readiness summary JSON written: ${path}`);
}

async function main() {
  console.log('Launch readiness gate');
  console.log('This command runs non-secret readiness checks and does not apply migrations or change dashboards.');

  const summaryJsonPath = getSummaryJsonPath();
  const results: GateResult[] = [];
  for (const gate of GATES) {
    results.push(await runGate(gate));
  }
  const requiredFailures = results.filter((result) => result.gate.required && result.status === 'fail');

  console.log('');
  console.log('=== Summary ===');
  for (const result of results) {
    const marker = result.status === 'pass' ? 'PASS' : 'FAIL';
    const timeoutNote = result.timedOut ? ' (timed out)' : '';
    console.log(`[${marker}] ${result.gate.name}${timeoutNote}`);
  }

  if (summaryJsonPath) writeSummaryJson(summaryJsonPath, results, requiredFailures);

  if (requiredFailures.length > 0) {
    console.log('');
    console.log('Required failures:');
    for (const result of requiredFailures) {
      console.log(`- ${result.gate.name}`);
    }
    console.log('\nLaunch readiness FAIL');
    process.exit(1);
  }

  console.log('\nLaunch readiness PASS');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
