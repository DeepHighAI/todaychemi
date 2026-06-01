import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

interface LaunchGateSummary {
  verdict?: unknown;
  requiredFailures?: unknown;
}

export interface WaitingStateFinding {
  file: string;
  label: string;
}

function usage(): never {
  console.error('Usage: pnpm verify:launch-waiting-state -- --summary-json <path> --evidence <path>');
  process.exit(1);
}

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) usage();
  return value;
}

function runStep(label: string, args: string[]): boolean {
  console.log('');
  console.log(`=== ${label} ===`);
  console.log(`$ ${PNPM} ${args.join(' ')}`);

  const result = spawnSync(PNPM, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(`[${label}] ${result.error.message}`);

  const ok = result.status === 0;
  console.log(`--- ${label}: ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

function requireFile(label: string, filePath: string): boolean {
  const absolutePath = resolve(process.cwd(), filePath);
  const ok = existsSync(absolutePath);
  console.log(`[file] ${ok ? 'OK' : 'FAIL'} ${label}: ${absolutePath}`);
  return ok;
}

function evidenceReferencesPath(source: string, filePath: string, root: string): boolean {
  const absolutePath = resolve(root, filePath);
  const normalizedAbsolute = absolutePath.replaceAll('\\', '/');
  const normalizedRelative = filePath.replaceAll('\\', '/');
  const sourceSummaryRows = source
    .replaceAll('\\', '/')
    .split(/\r?\n/)
    .filter((line) => line.includes('Source summary JSON'));

  return sourceSummaryRows.some((row) => {
    const cells = row.split('|').map((cell) => cell.trim()).filter(Boolean);
    return cells.includes(normalizedAbsolute) || cells.includes(normalizedRelative);
  });
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function sameStringSet(left: string[], right: string[]): boolean {
  const a = sortedUnique(left);
  const b = sortedUnique(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function extractEvidenceRequiredFailures(evidence: string): string[] {
  return evidence
    .split(/\r?\n/)
    .map((line) => {
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      if (cells.length !== 2) return null;
      const [gate, action] = cells;
      return action === 'Must be cleared before production open' ? gate : null;
    })
    .filter((gate): gate is string => typeof gate === 'string' && gate !== 'Gate');
}

export function scanWaitingStateArtifacts(
  summaryJsonPath: string,
  evidencePath: string,
  root = process.cwd(),
): WaitingStateFinding[] {
  const findings: WaitingStateFinding[] = [];
  const absoluteSummaryPath = resolve(root, summaryJsonPath);
  const absoluteEvidencePath = resolve(root, evidencePath);

  if (!existsSync(absoluteSummaryPath)) {
    findings.push({ file: summaryJsonPath, label: 'missing launch summary JSON' });
  }
  if (!existsSync(absoluteEvidencePath)) {
    findings.push({ file: evidencePath, label: 'missing launch evidence markdown' });
  }
  if (findings.length > 0) return findings;

  let summary: LaunchGateSummary;
  try {
    summary = JSON.parse(readFileSync(absoluteSummaryPath, 'utf8')) as LaunchGateSummary;
  } catch {
    return [{ file: summaryJsonPath, label: 'invalid launch summary JSON' }];
  }

  const evidence = readFileSync(absoluteEvidencePath, 'utf8');
  if (!evidenceReferencesPath(evidence, summaryJsonPath, root)) {
    findings.push({ file: evidencePath, label: 'evidence does not reference the provided summary JSON' });
  }

  if (!/\|\s*Launch readiness verdict\s*\|\s*FAIL\s*\|/.test(evidence)) {
    findings.push({ file: evidencePath, label: 'evidence does not record FAIL launch readiness verdict' });
  }

  if (!/\|\s*Go\/No-Go\s*\|\s*오픈 보류\s*\|/.test(evidence)) {
    findings.push({ file: evidencePath, label: 'evidence does not record 오픈 보류 Go/No-Go' });
  }

  const requiredFailures = asStringArray(summary.requiredFailures);
  for (const failure of requiredFailures) {
    const escaped = failure.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*Must be cleared before production open\\s*\\|`);
    if (!row.test(evidence)) {
      findings.push({ file: evidencePath, label: `evidence missing required failure row: ${failure}` });
    }
  }

  const evidenceRequiredFailures = extractEvidenceRequiredFailures(evidence);
  if (!sameStringSet(evidenceRequiredFailures, requiredFailures)) {
    findings.push({ file: evidencePath, label: 'evidence required failure rows do not exactly match summary JSON' });
  }

  return findings;
}

function main() {
  const summaryJson = readArg('--summary-json') ?? usage();
  const evidence = readArg('--evidence') ?? usage();

  console.log('Launch waiting-state check');
  console.log('This is a lightweight check for the external-settings waiting state.');
  console.log('It does not replace the full launch readiness gate or production smoke evidence.');

  let ok = true;
  ok = requireFile('launch summary JSON', summaryJson) && ok;
  ok = requireFile('launch evidence markdown', evidence) && ok;

  if (ok) {
    const artifactFindings = scanWaitingStateArtifacts(summaryJson, evidence);
    const artifactOk = artifactFindings.length === 0;
    console.log(`[artifact] ${artifactOk ? 'OK' : 'FAIL'} summary/evidence consistency`);
    for (const finding of artifactFindings) {
      console.log(`- ${finding.file} - ${finding.label}`);
    }
    ok = artifactOk && ok;
  }

  if (ok) {
    ok = runStep('known external blockers', [
      'verify:known-external-blockers',
      '--summary-json',
      summaryJson,
    ]) && ok;
    ok = runStep('launch audit artifacts', ['verify:launch-audit-readiness']) && ok;
    ok = runStep('secret-free launch evidence', [
      'verify:launch-evidence-readiness',
      summaryJson,
      evidence,
    ]) && ok;
  }

  console.log('');
  console.log('Interpretation:');
  console.log('- PASS means the local artifacts still describe a clean external-settings waiting state.');
  console.log('- PASS does not mean production can open.');
  console.log('- After external settings are configured, run the full launch readiness gate again.');

  if (!ok) {
    console.error('\nLaunch waiting-state check FAIL');
    process.exit(1);
  }

  console.log('\nLaunch waiting-state check PASS');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
