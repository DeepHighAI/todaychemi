import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const KNOWN_EXTERNAL_REQUIRED_FAILURES = [
  'launch env',
  'Auth readiness',
  'OpenAI/ZDR readiness',
  'Toss live readiness',
  'Vercel readiness',
  'Operations/E2E readiness',
  'External settings checklist readiness',
] as const;

const EXPECTED_REQUIRED_GATE_NAMES = [
  'launch env',
  'Secret/public env boundary readiness',
  'Launch audit artifact readiness',
  'External settings checklist readiness',
  'TypeScript check',
  'Lint check',
  'Unit test suite',
  'Production build',
  'Auth readiness',
  'OpenAI/ZDR readiness',
  'LLM/score boundary readiness',
  'LLM resilience readiness',
  'payment DB readiness',
  'payment flow readiness',
  'Toss live readiness',
  'billing policy readiness',
  'DB/RLS readiness',
  'Supabase migration dry-run',
  'Supabase RPC security readiness',
  'Vercel readiness',
  'Operations/E2E readiness',
  'Supply-chain readiness',
  'Public E2E readiness',
  'Auth E2E readiness',
  'Core E2E coverage readiness',
] as const;

interface LaunchGateSummary {
  verdict?: unknown;
  requiredFailures?: unknown;
  results?: unknown;
}

interface GateResult {
  name?: unknown;
  required?: unknown;
  status?: unknown;
  timedOut?: unknown;
}

function usage(): never {
  console.error('Usage: pnpm verify:known-external-blockers -- --summary-json <path>');
  process.exit(1);
}

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) usage();
  return value;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function sortUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function sameSet(left: string[], right: readonly string[]): boolean {
  const a = sortUnique(left);
  const b = sortUnique([...right]);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function getUnexpectedPassingOrMissingRequired(results: unknown, requiredFailures: string[]): string[] {
  if (!Array.isArray(results)) return ['summary results missing'];

  const failureSet = new Set(requiredFailures);
  const problems: string[] = [];

  for (const result of results as GateResult[]) {
    if (result.required !== true || typeof result.name !== 'string') continue;
    const failed = result.status === 'fail';
    if (failed !== failureSet.has(result.name)) {
      problems.push(`${result.name}: status=${String(result.status)}, listedFailure=${failureSet.has(result.name)}`);
    }
  }

  return problems;
}

function getTimeoutProblems(results: unknown): string[] {
  if (!Array.isArray(results)) return ['summary results missing'];

  return (results as GateResult[])
    .filter((result) => result.timedOut === true)
    .map((result) => `${typeof result.name === 'string' ? result.name : '(unknown gate)'}: timedOut=true`);
}

export function getGateCoverageProblems(results: unknown): string[] {
  if (!Array.isArray(results)) return ['summary results missing'];

  const requiredNames = (results as GateResult[])
    .filter((result) => result.required === true && typeof result.name === 'string')
    .map((result) => result.name as string);
  const requiredNameSet = new Set(requiredNames);
  const expectedNameSet = new Set<string>([...EXPECTED_REQUIRED_GATE_NAMES]);
  const problems: string[] = [];

  for (const expected of EXPECTED_REQUIRED_GATE_NAMES) {
    if (!requiredNameSet.has(expected)) problems.push(`${expected}: missing required gate result`);
  }

  for (const name of requiredNameSet) {
    if (!expectedNameSet.has(name)) problems.push(`${name}: unexpected required gate result`);
  }

  const duplicates = requiredNames.filter((name, index) => requiredNames.indexOf(name) !== index);
  for (const duplicate of sortUnique(duplicates)) {
    problems.push(`${duplicate}: duplicate required gate result`);
  }

  return problems;
}

function main() {
  const summaryPath = readArg('--summary-json') ?? usage();
  const absolutePath = resolve(process.cwd(), summaryPath);

  console.log('Known external blocker check');
  console.log(`Summary: ${absolutePath}`);
  console.log('');

  if (!existsSync(absolutePath)) {
    console.error(`Missing summary JSON: ${absolutePath}`);
    process.exit(1);
  }

  const summary = JSON.parse(readFileSync(absolutePath, 'utf8')) as LaunchGateSummary;
  const requiredFailures = asStringArray(summary.requiredFailures);
  const expected = [...KNOWN_EXTERNAL_REQUIRED_FAILURES];

  const verdictOk = summary.verdict === 'FAIL';
  console.log(`[verdict] ${verdictOk ? 'OK' : 'FAIL'} summary verdict is FAIL while external blockers remain`);

  const exactMatch = sameSet(requiredFailures, expected);
  console.log(`[required failures] ${exactMatch ? 'OK' : 'FAIL'} exact known external blocker set`);
  console.log(`Expected: ${expected.join(', ')}`);
  console.log(`Actual:   ${requiredFailures.length > 0 ? requiredFailures.join(', ') : '(none)'}`);

  const consistencyProblems = getUnexpectedPassingOrMissingRequired(summary.results, requiredFailures);
  const consistencyOk = consistencyProblems.length === 0;
  console.log(`[summary consistency] ${consistencyOk ? 'OK' : 'FAIL'} required result statuses match requiredFailures`);
  for (const problem of consistencyProblems) console.log(`- ${problem}`);

  const gateCoverageProblems = getGateCoverageProblems(summary.results);
  const gateCoverageOk = gateCoverageProblems.length === 0;
  console.log(`[gate coverage] ${gateCoverageOk ? 'OK' : 'FAIL'} latest summary includes every launch-required gate`);
  for (const problem of gateCoverageProblems) console.log(`- ${problem}`);

  const timeoutProblems = getTimeoutProblems(summary.results);
  const timeoutOk = timeoutProblems.length === 0;
  console.log(`[timeouts] ${timeoutOk ? 'OK' : 'FAIL'} no gate timed out in the latest summary`);
  for (const problem of timeoutProblems) console.log(`- ${problem}`);

  console.log('');
  console.log('Interpretation:');
  console.log('- PASS here does not mean production can open.');
  console.log('- It means the latest launch summary is blocked only by known external dashboard/env/checklist evidence work.');
  console.log('- The canonical Go/No-Go remains the launch readiness gate and production smoke evidence.');

  if (!verdictOk || !exactMatch || !consistencyOk || !gateCoverageOk || !timeoutOk) {
    console.error('\nKnown external blocker check FAIL');
    process.exit(1);
  }

  console.log('\nKnown external blocker check PASS');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
