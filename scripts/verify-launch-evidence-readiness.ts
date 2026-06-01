import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface Finding {
  file: string;
  label: string;
  line: number;
  context?: string;
}

interface Pattern {
  label: string;
  regex: RegExp;
}

interface LaunchGateSummary {
  verdict?: unknown;
  requiredFailures?: unknown;
}

type GoNoGoDecision = '서비스 오픈 가능' | '조건부 가능' | '오픈 보류';

const DEFAULT_FILES = [
  'docs/qa/launch_gate_2026-05-31_local.json',
  'docs/qa/launch_evidence_2026-05-31_local.md',
  'docs/qa/external_settings_checklist.md',
];

const GO_NO_GO_DECISIONS: GoNoGoDecision[] = ['서비스 오픈 가능', '조건부 가능', '오픈 보류'];

const PATTERNS: Pattern[] = [
  {
    label: 'OpenAI-style secret key value',
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    label: 'full OpenAI project id value',
    regex: /\bproj_[A-Za-z0-9_-]{8,}\b/,
  },
  {
    label: 'Toss secret/client key value',
    regex: /\b(?:live|test)_(?:sk|ck)_[A-Za-z0-9_-]{8,}\b/,
  },
  {
    label: 'Supabase service-role JWT assignment',
    regex: /\bSUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["']?eyJ[A-Za-z0-9_-]+/i,
  },
  {
    label: 'JWT-like token value',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    label: 'Sentry DSN URL value',
    regex: /\bhttps:\/\/[A-Za-z0-9]{16,64}@[A-Za-z0-9.-]*ingest(?:\.[A-Za-z0-9-]+)?\.sentry\.io\/\d+\b/i,
  },
  {
    label: 'server secret env assignment',
    regex: /\b(?:OPENAI_API_KEY|TOSS_SECRET_KEY|KAKAO_ADMIN_KEY|SENTRY_DSN|ANTHROPIC_API_KEY)\s*[:=]\s*\S+/i,
  },
  {
    label: 'raw birth_date value assignment',
    regex: /\bbirth_date\s*[:=]\s*["']?\d{4}-\d{2}-\d{2}\b/i,
  },
  {
    label: 'raw birth date evidence',
    regex:
      /(?:\b(?:birth(?:_date|date)?|dob|date_of_birth)\b|생년월일|생일|출생일)[^|\n]{0,40}\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{4}[-./]\d{1,2}[-./]\d{1,2}[^|\n]{0,40}(?:\b(?:birth(?:_date|date)?|dob|date_of_birth)\b|생년월일|생일|출생일)/i,
  },
  {
    label: 'raw email value assignment',
    regex: /\bemail\s*[:=]\s*["']?[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
  {
    label: 'raw email address value',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
  {
    label: 'raw nickname value assignment',
    regex: /\bnickname\s*[:=]\s*["']?[^"',\s|}][^"',|}]{1,40}/i,
  },
  {
    label: 'raw original gender assignment',
    regex: /\bgender\s*[:=]\s*["']?(?:M|F|남|여|male|female)\b/i,
  },
];

function lineNumberForIndex(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split(/\r?\n/).length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readTableValue(source: string, label: string): string | null {
  const regex = new RegExp(`^\\|\\s*${escapeRegExp(label)}\\s*\\|\\s*([^|]+?)\\s*\\|\\s*$`, 'm');
  return regex.exec(source)?.[1]?.trim() ?? null;
}

function readFinalDecision(source: string): string | null {
  return /^Final decision:\s*(.+?)\s*$/m.exec(source)?.[1]?.trim() ?? null;
}

function readDecisionField(source: string, label: string): string | null {
  return new RegExp(`^${escapeRegExp(label)}:\\s*(.*?)\\s*$`, 'm').exec(source)?.[1]?.trim() ?? null;
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

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/');
}

function pathCellMatches(cell: string, filePath: string, root: string): boolean {
  const normalizedCell = normalizePath(cell);
  const normalizedInput = normalizePath(filePath);
  const normalizedAbsolute = normalizePath(resolve(root, filePath));
  return normalizedCell === normalizedInput || normalizedCell === normalizedAbsolute;
}

function extractEvidenceRequiredFailures(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => {
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      if (cells.length !== 2) return null;
      const [gate, action] = cells;
      return action === 'Must be cleared before production open' ? gate : null;
    })
    .filter((gate): gate is string => typeof gate === 'string' && gate !== 'Gate');
}

function isGeneratedLaunchEvidence(source: string): boolean {
  return /^# Launch Evidence - .+/m.test(source);
}

function launchAllowedDecision(source: string): '서비스 오픈 가능' | '조건부 가능' | null {
  const goNoGo = readTableValue(source, 'Go/No-Go');
  return goNoGo === '서비스 오픈 가능' || goNoGo === '조건부 가능' ? goNoGo : null;
}

const SERVICE_OPEN_REQUIRED_SECTIONS = [
  '## Dashboard Evidence',
  '## Production Smoke Notes',
  '## Payment Ledger Evidence',
  '## Monitoring',
  '## Canary Evidence',
  '## Decision',
] as const;

const LAUNCH_ALLOWED_REQUIRED_DECISION_FIELDS = [
  'Reason',
  'Known risks accepted',
  'Rollback trigger',
  'Next review time',
] as const;

const EXTERNAL_CHECKLIST_PLACEHOLDER_CELLS = new Set([
  'alert name only',
  'checked',
  'dashboard/contract reference no secret',
  'fixed production origin',
  'localhost paths only',
  'live_ck_... prefix only',
  'live_ck_ prefix only',
  'live_sk_... prefix only',
  'live_sk_ prefix only',
  'number only',
  'origin only',
  'origin only no path',
  'owner/date',
  'owner only',
  'owner/trigger only',
  'pass/fail',
  'path only',
  'presence only',
  'proj_ shape only',
  'project id prefix only',
  'project name/id prefix only',
  'project name only',
  'provider enabled',
  'public',
  'public anon',
  'tbd',
  'toss_order_id/owner only',
  'toss_order_id only',
  'unset confirmation',
  'url path only',
  'value never recorded',
]);

const EXTERNAL_CHECKLIST_STATUS_COLUMNS = new Set(['Result', 'Production', 'Preview']);
const EXTERNAL_CHECKLIST_EVIDENCE_COLUMNS = new Set(['Evidence', 'Notes']);

function splitMarkdownRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function normalizeChecklistCell(cell: string): string {
  return cell
    .replace(/`/g, '')
    .replace(/[,.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isLaunchExternalChecklistPlaceholderCell(cell: string): boolean {
  return EXTERNAL_CHECKLIST_PLACEHOLDER_CELLS.has(normalizeChecklistCell(cell));
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function describeChecklistRow(cells: string[], statusIndexes: number[], evidenceIndex: number): string {
  const ignoredIndexes = new Set([...statusIndexes, evidenceIndex].filter((cellIndex) => cellIndex >= 0));
  return cells
    .filter((cell, cellIndex) => !ignoredIndexes.has(cellIndex) && cell.trim().length > 0)
    .slice(0, 2)
    .join(' / ');
}

function scanLaunchEvidenceStructure(inputPath: string, source: string): Finding[] {
  if (!isGeneratedLaunchEvidence(source)) return [];

  const findings: Finding[] = [];
  const environment = readTableValue(source, 'Environment');
  const verdict = readTableValue(source, 'Launch readiness verdict');
  const goNoGo = readTableValue(source, 'Go/No-Go');
  const sourceSummaryJson = readTableValue(source, 'Source summary JSON');
  const finalDecision = readFinalDecision(source);

  if (!sourceSummaryJson) {
    findings.push({ file: inputPath, label: 'generated evidence missing Source summary JSON', line: 0 });
  }

  if (verdict !== 'PASS' && verdict !== 'FAIL') {
    findings.push({ file: inputPath, label: 'invalid or missing launch readiness verdict', line: 0 });
  }

  if (!goNoGo || !(GO_NO_GO_DECISIONS as string[]).includes(goNoGo)) {
    findings.push({ file: inputPath, label: 'invalid or missing canonical Go/No-Go value', line: 0 });
  }

  if (!finalDecision || finalDecision !== goNoGo) {
    findings.push({ file: inputPath, label: 'Final decision does not match Go/No-Go value', line: 0 });
  }

  if (verdict === 'FAIL' && goNoGo !== '오픈 보류') {
    findings.push({ file: inputPath, label: 'FAIL launch readiness evidence must remain 오픈 보류', line: 0 });
  }

  const launchDecision = launchAllowedDecision(source);
  if (launchDecision) {
    if (environment !== 'Production') {
      findings.push({ file: inputPath, label: `${launchDecision} evidence must be Production environment`, line: 0 });
    }

    if (verdict !== 'PASS') {
      findings.push({ file: inputPath, label: `${launchDecision} evidence must have PASS launch readiness verdict`, line: 0 });
    }

    const tbdIndex = source.search(/\bTBD\b/);
    if (tbdIndex >= 0) {
      findings.push({
        file: inputPath,
        label: `${launchDecision} evidence must not contain TBD placeholders`,
        line: lineNumberForIndex(source, tbdIndex),
      });
    }

    for (const section of SERVICE_OPEN_REQUIRED_SECTIONS) {
      if (!source.includes(section)) {
        findings.push({
          file: inputPath,
          label: `${launchDecision} evidence missing required section: ${section}`,
          line: 0,
        });
      }
    }

    for (const field of LAUNCH_ALLOWED_REQUIRED_DECISION_FIELDS) {
      if (!readDecisionField(source, field)) {
        findings.push({
          file: inputPath,
          label: `${launchDecision} evidence missing decision field: ${field}`,
          line: 0,
        });
      }
    }
  }

  return findings;
}

function isLaunchAllowedEvidence(source: string): boolean {
  return isGeneratedLaunchEvidence(source) && launchAllowedDecision(source) !== null;
}

function isExternalSettingsChecklist(inputPath: string, source: string): boolean {
  return normalizePath(inputPath).endsWith('external_settings_checklist.md')
    || /^# External Settings Checklist\b/m.test(source);
}

function scanServiceOpenChecklistCoverage(sources: Map<string, string>): Finding[] {
  const findings: Finding[] = [];
  const launchAllowedEvidence = [...sources]
    .map(([inputPath, source]) => ({ inputPath, source, decision: launchAllowedDecision(source) }))
    .filter((entry): entry is { inputPath: string; source: string; decision: '서비스 오픈 가능' | '조건부 가능' } => (
      isLaunchAllowedEvidence(entry.source) && entry.decision !== null
    ));
  if (launchAllowedEvidence.length === 0) return findings;

  const decisionLabel = launchAllowedEvidence[0]?.decision ?? '서비스 오픈 가능';

  const checklists = [...sources].filter(([inputPath, source]) => isExternalSettingsChecklist(inputPath, source));
  if (checklists.length === 0) {
    for (const { inputPath, decision } of launchAllowedEvidence) {
      findings.push({
        file: inputPath,
        label: `${decision} evidence must include external settings checklist in verification inputs`,
        line: 0,
      });
    }
    return findings;
  }

  for (const [inputPath, source] of checklists) {
    const lines = source.split(/\r?\n/);
    let statusIndexes: number[] = [];
    let evidenceIndex = -1;
    let inTable = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
        inTable = false;
        statusIndexes = [];
        evidenceIndex = -1;
        return;
      }

      if (!inTable) {
        const headerCells = splitMarkdownRow(line);
        statusIndexes = headerCells
          .map((cell, cellIndex) => (EXTERNAL_CHECKLIST_STATUS_COLUMNS.has(cell) ? cellIndex : -1))
          .filter((cellIndex) => cellIndex >= 0);
        evidenceIndex = headerCells.findIndex((cell) => EXTERNAL_CHECKLIST_EVIDENCE_COLUMNS.has(cell));
        if (statusIndexes.length > 0 && evidenceIndex < 0) {
          findings.push({
            file: inputPath,
            label: `${decisionLabel} external settings checklist status table missing Evidence/Notes column`,
            line: index + 1,
          });
        }
        inTable = statusIndexes.length > 0;
        return;
      }

      if (isTableSeparator(line)) return;

      const cells = splitMarkdownRow(line);
      const context = describeChecklistRow(cells, statusIndexes, evidenceIndex);
      let reportedTbdForRow = false;

      for (const statusIndex of statusIndexes) {
        const status = cells[statusIndex] ?? '';
        const normalized = normalizeChecklistCell(status);
        if (normalized === 'tbd' && !reportedTbdForRow) {
          findings.push({
            file: inputPath,
            label: `${decisionLabel} external settings checklist must not contain TBD placeholders`,
            line: index + 1,
            context,
          });
          reportedTbdForRow = true;
        }
        if (normalized === 'fail') {
          findings.push({
            file: inputPath,
            label: `${decisionLabel} external settings checklist must not contain FAIL status cells`,
            line: index + 1,
            context,
          });
        }
      }

      if (evidenceIndex >= 0) {
        const evidence = cells[evidenceIndex] ?? '';
        const normalizedEvidence = normalizeChecklistCell(evidence);
        if (!normalizedEvidence || isLaunchExternalChecklistPlaceholderCell(evidence)) {
          findings.push({
            file: inputPath,
            label: `${decisionLabel} external settings checklist evidence is still a placeholder: ${evidence || '<empty>'}`,
            line: index + 1,
            context,
          });
        }
      }
    });
  }

  return findings;
}

function loadLaunchSummary(inputPath: string, root: string): LaunchGateSummary | null {
  if (!/\.json$/i.test(inputPath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(resolve(root, inputPath), 'utf8')) as LaunchGateSummary;
    if (parsed && typeof parsed === 'object' && ('verdict' in parsed || 'requiredFailures' in parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function scanSummaryEvidenceConsistency(
  filePaths: string[],
  root: string,
  sources: Map<string, string>,
): Finding[] {
  const findings: Finding[] = [];
  const summaries = filePaths
    .map((filePath) => ({ filePath, summary: loadLaunchSummary(filePath, root) }))
    .filter((entry): entry is { filePath: string; summary: LaunchGateSummary } => entry.summary !== null);

  if (summaries.length === 0) {
    for (const [evidencePath, source] of sources) {
      const decision = launchAllowedDecision(source);
      if (isGeneratedLaunchEvidence(source) && decision) {
        findings.push({
          file: evidencePath,
          label: `${decision} evidence must include launch summary JSON in verification inputs`,
          line: 0,
        });
      }
    }
    return findings;
  }

  for (const [evidencePath, source] of sources) {
    if (!isGeneratedLaunchEvidence(source)) continue;

    const sourceSummaryJson = readTableValue(source, 'Source summary JSON');
    if (!sourceSummaryJson) {
      findings.push({ file: evidencePath, label: 'generated evidence missing Source summary JSON', line: 0 });
      continue;
    }

    const match = summaries.find((entry) => pathCellMatches(sourceSummaryJson, entry.filePath, root));
    if (!match) {
      findings.push({ file: evidencePath, label: 'evidence Source summary JSON does not match provided summary JSON', line: 0 });
      continue;
    }

    const verdict = readTableValue(source, 'Launch readiness verdict');
    if (match.summary.verdict === 'PASS' || match.summary.verdict === 'FAIL') {
      if (verdict !== match.summary.verdict) {
        findings.push({ file: evidencePath, label: 'evidence launch readiness verdict does not match summary JSON', line: 0 });
      }
    }

    const summaryFailures = asStringArray(match.summary.requiredFailures);
    const evidenceFailures = extractEvidenceRequiredFailures(source);
    if (!sameStringSet(evidenceFailures, summaryFailures)) {
      findings.push({ file: evidencePath, label: 'evidence required failure rows do not match summary JSON', line: 0 });
    }
  }

  return findings;
}

export function scanLaunchEvidence(filePaths: string[], root = process.cwd()): Finding[] {
  const findings: Finding[] = [];
  const sources = new Map<string, string>();

  for (const inputPath of filePaths) {
    const file = resolve(root, inputPath);
    if (!existsSync(file)) {
      findings.push({ file: inputPath, label: 'missing evidence file', line: 0 });
      continue;
    }

    const source = readFileSync(file, 'utf8');
    sources.set(inputPath, source);
    for (const pattern of PATTERNS) {
      const match = pattern.regex.exec(source);
      if (match?.index !== undefined) {
        findings.push({
          file: inputPath,
          label: pattern.label,
          line: lineNumberForIndex(source, match.index),
        });
      }
    }

    findings.push(...scanLaunchEvidenceStructure(inputPath, source));
  }

  findings.push(...scanSummaryEvidenceConsistency(filePaths, root, sources));
  findings.push(...scanServiceOpenChecklistCoverage(sources));

  return findings;
}

function main() {
  const args = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === '--'));
  const files = args.length > 0 ? args : DEFAULT_FILES;

  console.log('Launch evidence readiness check');
  console.log('Scope: secret-free launch summary/evidence artifacts.');

  const findings = scanLaunchEvidence(files);
  if (findings.length > 0) {
    console.log('');
    console.log('Findings:');
    for (const finding of findings) {
      const location = finding.line > 0 ? `${finding.file}:${finding.line}` : finding.file;
      const context = finding.context ? ` (${finding.context})` : '';
      console.log(`- ${location} - ${finding.label}${context}`);
    }
    console.error('\nLaunch evidence readiness FAIL');
    process.exit(1);
  }

  console.log('');
  for (const file of files) console.log(`[evidence] OK ${file}`);
  console.log('\nLaunch evidence readiness PASS');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
