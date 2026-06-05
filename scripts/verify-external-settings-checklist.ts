import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { scanLaunchEvidence } from './verify-launch-evidence-readiness';

interface Finding {
  file: string;
  label: string;
  line: number;
  context?: string;
}

const DEFAULT_CHECKLIST = 'docs/qa/external_settings_checklist.md';

const REQUIRED_SECTIONS = [
  '# External Settings Checklist',
  '## Production Origin',
  '## Vercel Environment Variables',
  '## Supabase Auth',
  '## Google / Kakao Developer Consoles',
  '## OpenAI / ZDR',
  '## Anthropic Fallback',
  '## Toss Payments',
  '## Sentry / Operations',
  '## Verification Commands',
] as const;

const REQUIRED_COMMANDS = [
  'pnpm print:launch-dashboard-plan',
  'pnpm print:vercel-env-plan',
  'pnpm verify:origin-shape-readiness',
  'pnpm verify:external-settings-readiness',
  'pnpm verify:external-settings-checklist',
  'pnpm verify:launch-readiness -- --summary-json',
  'pnpm create:launch-evidence',
  'pnpm verify:launch-evidence-readiness',
] as const;

const STATUS_COLUMNS = new Set(['Result', 'Production', 'Preview']);
const EVIDENCE_COLUMNS = new Set(['Evidence', 'Notes']);
const PASSING_STATUS = /^(OK|PASS|N\/A\(.+\))$/;
const NA_STATUS = /^N\/A\((.+)\)$/;
const PLACEHOLDER_EVIDENCE = new Set([
  'alert name only',
  'checked',
  'dashboard/contract reference no secret',
  'fixed production origin',
  'localhost paths only',
  'live_gck_... prefix only',
  'live_gck_ prefix only',
  'live_gsk_... prefix only',
  'live_gsk_ prefix only',
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
  'toss_order_id/feature_ref only',
  'toss_order_id only',
  'unset confirmation',
  'url path only',
  'value never recorded',
]);
const PLACEHOLDER_NA_REASONS = new Set([
  'n/a',
  'na',
  'none',
  'optional',
  'reason',
  'tbd',
  '사유',
  '없음',
]);

function splitMarkdownRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function normalizeEvidenceCell(cell: string): string {
  return cell
    .replace(/`/g, '')
    .replace(/[,.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isExternalSettingsChecklistPlaceholderEvidence(cell: string): boolean {
  return PLACEHOLDER_EVIDENCE.has(normalizeEvidenceCell(cell)) || /<[^>]+>/.test(cell);
}

function normalizeStatusReason(status: string): string {
  const match = status.match(NA_STATUS);
  return normalizeEvidenceCell(match?.[1] ?? '');
}

function describeRow(cells: string[], statusIndexes: number[], evidenceIndex: number): string {
  const ignoredIndexes = new Set([...statusIndexes, evidenceIndex].filter((cellIndex) => cellIndex >= 0));
  return cells
    .filter((cell, cellIndex) => !ignoredIndexes.has(cellIndex) && cell.trim().length > 0)
    .slice(0, 2)
    .join(' / ');
}

function checklistSectionForLine(source: string, lineNumber: number): string {
  if (lineNumber <= 0) return 'Checklist structure';

  const lines = source.split(/\r?\n/);
  let section = 'Checklist introduction';
  for (let index = 0; index < Math.min(lineNumber, lines.length); index += 1) {
    const match = /^(#{1,2})\s+(.+?)\s*$/.exec(lines[index] ?? '');
    if (match) section = match[2] ?? section;
  }
  return section;
}

export function summarizeExternalSettingsFindingsBySection(source: string, findings: Finding[]) {
  const summaries = new Map<string, { section: string; count: number; firstContext?: string }>();

  for (const finding of findings) {
    const section = checklistSectionForLine(source, finding.line);
    const current = summaries.get(section) ?? { section, count: 0, firstContext: finding.context };
    current.count += 1;
    current.firstContext ??= finding.context;
    summaries.set(section, current);
  }

  return [...summaries.values()];
}

function scanStatusCells(source: string, checklistPath: string): Finding[] {
  const findings: Finding[] = [];
  const lines = source.split(/\r?\n/);
  let statusIndexes: number[] = [];
  let evidenceIndex = -1;
  let inTable = false;

  lines.forEach((line, index) => {
    const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|');
    if (!isTableLine) {
      inTable = false;
      statusIndexes = [];
      evidenceIndex = -1;
      return;
    }

    if (!inTable) {
      const headerCells = splitMarkdownRow(line);
      statusIndexes = headerCells
        .map((cell, cellIndex) => (STATUS_COLUMNS.has(cell) ? cellIndex : -1))
        .filter((cellIndex) => cellIndex >= 0);
      evidenceIndex = headerCells.findIndex((cell) => EVIDENCE_COLUMNS.has(cell));
      if (statusIndexes.length > 0 && evidenceIndex < 0) {
        findings.push({
          file: checklistPath,
          label: 'external settings checklist status table missing Evidence/Notes column',
          line: index + 1,
        });
      }
      inTable = statusIndexes.length > 0;
      return;
    }

    if (isTableSeparator(line)) return;

    const cells = splitMarkdownRow(line);
    const context = describeRow(cells, statusIndexes, evidenceIndex);
    let reportedTbdForRow = false;
    let hasCompletedStatusForEvidence = false;
    for (const statusIndex of statusIndexes) {
      const status = cells[statusIndex] ?? '';
      if (status === 'TBD') {
        if (!reportedTbdForRow) {
          findings.push({
            file: checklistPath,
            label: 'external settings checklist still contains TBD placeholders',
            line: index + 1,
            context,
          });
          reportedTbdForRow = true;
        }
        continue;
      }
      if (status === 'FAIL') {
        findings.push({
          file: checklistPath,
          label: 'external settings checklist still contains FAIL status cells',
          line: index + 1,
          context,
        });
        continue;
      }
      if (!PASSING_STATUS.test(status)) {
        findings.push({
          file: checklistPath,
          label: `invalid external settings checklist status: ${status || '<empty>'}`,
          line: index + 1,
          context,
        });
        continue;
      }

      const normalizedReason = normalizeStatusReason(status);
      if (NA_STATUS.test(status) && PLACEHOLDER_NA_REASONS.has(normalizedReason)) {
        findings.push({
          file: checklistPath,
          label: `external settings checklist N/A reason is still a placeholder: ${status}`,
          line: index + 1,
          context,
        });
        continue;
      }

      hasCompletedStatusForEvidence = true;
    }

    if (hasCompletedStatusForEvidence && evidenceIndex >= 0) {
      const evidence = cells[evidenceIndex] ?? '';
      const normalizedEvidence = normalizeEvidenceCell(evidence);
      if (!normalizedEvidence || isExternalSettingsChecklistPlaceholderEvidence(evidence)) {
        findings.push({
          file: checklistPath,
          label: `external settings checklist evidence is still a placeholder: ${evidence || '<empty>'}`,
          line: index + 1,
          context,
        });
      }
    }
  });

  return findings;
}

export function scanExternalSettingsChecklist(
  checklistPath = DEFAULT_CHECKLIST,
  root = process.cwd(),
): Finding[] {
  const findings: Finding[] = [];
  const absolutePath = resolve(root, checklistPath);

  if (!existsSync(absolutePath)) {
    return [{ file: checklistPath, label: 'missing external settings checklist', line: 0 }];
  }

  const source = readFileSync(absolutePath, 'utf8');

  for (const section of REQUIRED_SECTIONS) {
    if (!source.includes(section)) {
      findings.push({
        file: checklistPath,
        label: `missing required checklist section: ${section}`,
        line: 0,
      });
    }
  }

  for (const command of REQUIRED_COMMANDS) {
    if (!source.includes(command)) {
      findings.push({
        file: checklistPath,
        label: `missing required verification command: ${command}`,
        line: 0,
      });
    }
  }

  findings.push(...scanStatusCells(source, checklistPath));

  const evidenceFindings = scanLaunchEvidence([checklistPath], root);
  for (const finding of evidenceFindings) {
    findings.push({
      file: finding.file,
      label: `secret/PII scan failed: ${finding.label}`,
      line: finding.line,
    });
  }

  return findings;
}

function main() {
  const checklistPath = process.argv[2] ?? DEFAULT_CHECKLIST;
  const absolutePath = resolve(process.cwd(), checklistPath);
  console.log('External settings checklist readiness check');
  console.log(`Checklist: ${checklistPath}`);

  const findings = scanExternalSettingsChecklist(checklistPath);
  if (findings.length > 0) {
    const source = existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
    const sectionSummaries = summarizeExternalSettingsFindingsBySection(source, findings);
    if (sectionSummaries.length > 0) {
      console.log('');
      console.log('Summary by section:');
      for (const summary of sectionSummaries) {
        const first = summary.firstContext ? `; first: ${summary.firstContext}` : '';
        console.log(`- ${summary.section}: ${summary.count} unresolved${first}`);
      }
      console.log('');
      console.log(
        'Recommended order: Production Origin -> Vercel Environment Variables -> Supabase Auth -> Google/Kakao -> OpenAI/ZDR -> Anthropic -> Toss -> Sentry.',
      );
    }

    console.log('');
    console.log('Findings:');
    for (const finding of findings) {
      const location = finding.line > 0 ? `${finding.file}:${finding.line}` : finding.file;
      const context = finding.context ? ` (${finding.context})` : '';
      console.log(`- ${location} - ${finding.label}${context}`);
    }
    console.log('');
    console.log('Next step:');
    console.log('- Open docs/runbooks/external_launch_settings.md and fill this checklist section by section.');
    console.log('- MVP does not require a custom domain; use the fixed Vercel Production *.vercel.app origin.');
    console.log('- Before dashboard entry, run: pnpm verify:origin-shape-readiness -- --origin https://<project>.vercel.app');
    console.log('- Dashboard plan: pnpm print:launch-dashboard-plan -- --origin https://<project>.vercel.app');
    console.log('- Full launch gate must run with production-equivalent env loaded in local shell, CI, or validation environment.');
    console.log('- Record only secret-free evidence: project name, origin, URL path, prefix, alert name, owner, and PASS result.');
    console.error('\nExternal settings checklist readiness FAIL');
    process.exit(1);
  }

  console.log('');
  console.log(`[checklist] OK ${checklistPath}`);
  console.log('\nExternal settings checklist readiness PASS');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
