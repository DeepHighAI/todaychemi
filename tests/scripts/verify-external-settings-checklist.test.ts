import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import {
  isExternalSettingsChecklistPlaceholderEvidence,
  scanExternalSettingsChecklist,
  summarizeExternalSettingsFindingsBySection,
} from '../../scripts/verify-external-settings-checklist';
import { isLaunchExternalChecklistPlaceholderCell } from '../../scripts/verify-launch-evidence-readiness';

const tempDirs: string[] = [];
const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'external-settings-checklist-'));
  tempDirs.push(dir);
  return dir;
}

function write(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content, 'utf8');
}

function completedChecklist(): string {
  return [
    '# External Settings Checklist',
    '',
    '> secret-free launch checklist.',
    '',
    '## Production Origin',
    '| Item | Result | Evidence |',
    '|---|---:|---|',
    '| Vercel project is SAJU/TWODAY production project, not another app | PASS | project=twoday |',
    '',
    '## Vercel Environment Variables',
    '| Key | Production | Preview | Evidence |',
    '|---|---:|---:|---|',
    '| `NEXT_PUBLIC_APP_URL` | PASS | PASS | present in Vercel production+preview, origin=https://twoday-mvp.vercel.app |',
    '',
    'Legacy aliases must stay unset for launch:',
    '',
    '| Key | Production | Preview | Evidence |',
    '|---|---:|---:|---|',
    '| `TOSS_PAYMENTS_CLIENT_KEY` | PASS | PASS | legacy aliases absent in Vercel production+preview |',
    '| `TOSS_PAYMENTS_SECRET_KEY` | PASS | PASS | legacy aliases absent in Vercel production+preview |',
    '',
    '## Supabase Auth',
    '| Item | Result | Evidence |',
    '|---|---:|---|',
    '| Site URL equals `NEXT_PUBLIC_APP_URL` | PASS | origin=https://twoday-mvp.vercel.app |',
    '',
    '## Google / Kakao Developer Consoles',
    '| Console | Item | Result | Evidence |',
    '|---|---|---:|---|',
    '| Google | Web origin is `NEXT_PUBLIC_APP_URL` | PASS | origin=https://twoday-mvp.vercel.app |',
    '',
    '## OpenAI / ZDR',
    '| Item | Result | Evidence |',
    '|---|---:|---|',
    '| Production OpenAI project selected | PASS | project=Default project, id_prefix=proj_ |',
    '',
    '## Anthropic Fallback',
    '| Item | Result | Evidence |',
    '|---|---:|---|',
    '| `ANTHROPIC_API_KEY` configured in Vercel | PASS | present in Vercel production+preview |',
    '',
    '## Toss Payments',
    '| Item | Result | Evidence |',
    '|---|---:|---|',
    '| Toss live client key configured | PASS | live_gck prefix confirmed |',
    '',
    '## Sentry / Operations',
    '| Item | Result | Evidence |',
    '|---|---:|---|',
    '| Server DSN configured | PASS | sentry server DSN present in Vercel |',
    '',
    '## Verification Commands',
    '```bash',
    'pnpm print:launch-dashboard-plan -- --origin https://twoday-mvp.vercel.app',
    'pnpm print:vercel-env-plan',
    'pnpm verify:origin-shape-readiness -- --origin https://twoday-mvp.vercel.app',
    'pnpm verify:external-settings-readiness',
    'pnpm verify:external-settings-checklist',
    'pnpm verify:launch-readiness -- --summary-json docs/qa/launch_gate_2026-06-01_production.json',
    'pnpm create:launch-evidence -- --summary-json docs/qa/launch_gate_2026-06-01_production.json --out docs/qa/launch_evidence_2026-06-01_production.md --environment Production --go-no-go "조건부 가능"',
    'pnpm verify:launch-evidence-readiness docs/qa/launch_gate_2026-06-01_production.json docs/qa/launch_evidence_2026-06-01_production.md docs/qa/external_settings_checklist.md',
    '```',
  ].join('\n');
}

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

function collectCurrentTemplateEvidenceCells(): string[] {
  const source = readFileSync(resolve(process.cwd(), 'docs/qa/external_settings_checklist.md'), 'utf8');
  const evidenceCells: string[] = [];
  const lines = source.split(/\r?\n/);
  let statusIndexes: number[] = [];
  let evidenceIndex = -1;
  let inStatusTable = false;

  for (const line of lines) {
    const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|');
    if (!isTableLine) {
      inStatusTable = false;
      statusIndexes = [];
      evidenceIndex = -1;
      continue;
    }

    if (!inStatusTable) {
      const headerCells = splitMarkdownRow(line);
      statusIndexes = headerCells
        .map((cell, cellIndex) => (['Result', 'Production', 'Preview'].includes(cell) ? cellIndex : -1))
        .filter((cellIndex) => cellIndex >= 0);
      evidenceIndex = headerCells.findIndex((cell) => ['Evidence', 'Notes'].includes(cell));
      inStatusTable = statusIndexes.length > 0 && evidenceIndex >= 0;
      continue;
    }

    if (isTableSeparator(line)) continue;

    const cells = splitMarkdownRow(line);
    const hasTemplateStatus = statusIndexes.some((statusIndex) => ['TBD', 'FAIL'].includes(cells[statusIndex] ?? ''));
    const evidence = cells[evidenceIndex] ?? '';
    if (hasTemplateStatus && evidence) evidenceCells.push(evidence);
  }

  return [...new Set(evidenceCells)].sort((a, b) => a.localeCompare(b));
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('verify-external-settings-checklist', () => {
  it('prints concrete next steps when the current launch checklist is still incomplete', () => {
    const result = spawnSync(PNPM, ['verify:external-settings-checklist'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('Next step:');
    expect(result.stdout).toContain('docs/runbooks/external_launch_settings.md');
    expect(result.stdout).toContain('MVP does not require a custom domain');
    expect(result.stdout).toContain('pnpm verify:origin-shape-readiness -- --origin https://<project>.vercel.app');
    expect(result.stdout).toContain('pnpm print:launch-dashboard-plan -- --origin https://<project>.vercel.app');
    expect(result.stdout).toContain('production-equivalent env loaded in local shell, CI, or validation environment');
  });

  it('accepts a filled secret-free checklist', () => {
    const root = tempRoot();
    write(root, 'docs/qa/external_settings_checklist.md', completedChecklist());

    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root)).toEqual([]);
  });

  it('allows instructional TBD prose when table status cells are complete', () => {
    const root = tempRoot();
    write(
      root,
      'docs/qa/external_settings_checklist.md',
      completedChecklist().replace('> secret-free launch checklist.', '> Replace each `TBD` table status with OK, PASS, or N/A(concrete reason).'),
    );

    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root)).toEqual([]);
  });

  it('flags TBD placeholders in the checklist', () => {
    const root = tempRoot();
    write(root, 'docs/qa/external_settings_checklist.md', completedChecklist().replace('PASS | project=twoday', 'TBD | project=twoday'));

    const findings = scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root);
    expect(findings.map((finding) => finding.label)).toContain(
      'external settings checklist still contains TBD placeholders',
    );
    expect(findings.find((finding) => finding.label === 'external settings checklist still contains TBD placeholders')?.context).toBe(
      'Vercel project is SAJU/TWODAY production project, not another app',
    );
  });

  it('summarizes checklist findings by operator-facing section', () => {
    const root = tempRoot();
    const checklist = completedChecklist()
      .replace('PASS | project=twoday', 'TBD | project=twoday')
      .replace(
        'PASS | PASS | present in Vercel production+preview, origin=https://twoday-mvp.vercel.app',
        'TBD | TBD | fixed production origin',
      );
    write(root, 'docs/qa/external_settings_checklist.md', checklist);

    const findings = scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root);

    expect(summarizeExternalSettingsFindingsBySection(checklist, findings)).toEqual(
      expect.arrayContaining([
        {
          section: 'Production Origin',
          count: 1,
          firstContext: 'Vercel project is SAJU/TWODAY production project, not another app',
        },
        {
          section: 'Vercel Environment Variables',
          count: 1,
          firstContext: '`NEXT_PUBLIC_APP_URL`',
        },
      ]),
    );
  });

  it('delegates to launch evidence scanner for pasted secrets', () => {
    const root = tempRoot();
    write(
      root,
      'docs/qa/external_settings_checklist.md',
      completedChecklist().replace('project=Default project, id_prefix=proj_', 'sk-proj-abcdefghijklmnopqrstuvwxyz123456'),
    );

    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root).map((finding) => finding.label)).toContain(
      'secret/PII scan failed: OpenAI-style secret key value',
    );
  });

  it('flags explicit FAIL status cells as incomplete', () => {
    const root = tempRoot();
    write(root, 'docs/qa/external_settings_checklist.md', completedChecklist().replace('PASS | project=twoday', 'FAIL | project=twoday'));

    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root).map((finding) => finding.label)).toContain(
      'external settings checklist still contains FAIL status cells',
    );
  });

  it('flags arbitrary status cells that are not completion states', () => {
    const root = tempRoot();
    write(root, 'docs/qa/external_settings_checklist.md', completedChecklist().replace('PASS | project=twoday', 'DONE | project=twoday'));

    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root).map((finding) => finding.label)).toContain(
      'invalid external settings checklist status: DONE',
    );
  });

  it('flags placeholder evidence cells on completed rows', () => {
    const root = tempRoot();
    write(root, 'docs/qa/external_settings_checklist.md', completedChecklist().replace('project=twoday', 'project name only'));

    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root).map((finding) => finding.label)).toContain(
      'external settings checklist evidence is still a placeholder: project name only',
    );
  });

  it('flags every placeholder phrase used by the current checklist template', () => {
    const root = tempRoot();
    write(
      root,
      'docs/qa/external_settings_checklist.md',
      completedChecklist()
        .replace('project=twoday', 'owner/date')
        .replace('project=Default project, id_prefix=proj_', 'project name/id prefix only')
        .replace('live_gck prefix confirmed', '`proj_...` shape only'),
    );

    const labels = scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root).map((finding) => finding.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'external settings checklist evidence is still a placeholder: owner/date',
        'external settings checklist evidence is still a placeholder: project name/id prefix only',
        'external settings checklist evidence is still a placeholder: `proj_...` shape only',
      ]),
    );
  });

  it('keeps the current checklist template placeholder evidence catalog in sync across launch verifiers', () => {
    const evidenceCells = collectCurrentTemplateEvidenceCells();

    expect(evidenceCells.length).toBeGreaterThan(20);
    for (const evidenceCell of evidenceCells) {
      expect({
        evidenceCell,
        externalChecklistVerifier: isExternalSettingsChecklistPlaceholderEvidence(evidenceCell),
        launchEvidenceVerifier: isLaunchExternalChecklistPlaceholderCell(evidenceCell),
      }).toEqual({
        evidenceCell,
        externalChecklistVerifier: true,
        launchEvidenceVerifier: true,
      });
    }
  });

  it('flags TBD evidence cells even when status cells are complete', () => {
    const root = tempRoot();
    write(root, 'docs/qa/external_settings_checklist.md', completedChecklist().replace('project=twoday', 'TBD'));

    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root).map((finding) => finding.label)).toContain(
      'external settings checklist evidence is still a placeholder: TBD',
    );
  });

  it('flags normalized live key prefix placeholder evidence cells', () => {
    const root = tempRoot();
    write(root, 'docs/qa/external_settings_checklist.md', completedChecklist().replace('live_gck prefix confirmed', 'live_gck_... prefix only'));

    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root).map((finding) => finding.label)).toContain(
      'external settings checklist evidence is still a placeholder: live_gck_... prefix only',
    );
  });

  it('flags angle-bracket placeholders in completed evidence cells across launch verifiers', () => {
    const root = tempRoot();
    write(
      root,
      'docs/qa/external_settings_checklist.md',
      completedChecklist().replace('project=Default project, id_prefix=proj_', 'project=<OpenAI project name>, id_prefix=proj_'),
    );

    expect(isExternalSettingsChecklistPlaceholderEvidence('project=<OpenAI project name>, id_prefix=proj_')).toBe(true);
    expect(isLaunchExternalChecklistPlaceholderCell('project=<OpenAI project name>, id_prefix=proj_')).toBe(true);
    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root).map((finding) => finding.label)).toContain(
      'external settings checklist evidence is still a placeholder: project=<OpenAI project name>, id_prefix=proj_',
    );
  });

  it('flags placeholder evidence cells on production/preview env rows', () => {
    const root = tempRoot();
    write(
      root,
      'docs/qa/external_settings_checklist.md',
      completedChecklist().replace(
        'present in Vercel production+preview, origin=https://twoday-mvp.vercel.app',
        'fixed production origin',
      ),
    );

    const findings = scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root);
    expect(findings.map((finding) => finding.label)).toContain(
      'external settings checklist evidence is still a placeholder: fixed production origin',
    );
    expect(findings.filter((finding) => finding.label === 'external settings checklist evidence is still a placeholder: fixed production origin')).toHaveLength(1);
  });

  it('flags status tables that omit evidence columns', () => {
    const root = tempRoot();
    write(
      root,
      'docs/qa/external_settings_checklist.md',
      completedChecklist()
        .replace('| Key | Production | Preview | Evidence |', '| Key | Production | Preview |')
        .replace('|---|---:|---:|---|', '|---|---:|---:|')
        .replace(' | present in Vercel production+preview, origin=https://twoday-mvp.vercel.app', ''),
    );

    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root).map((finding) => finding.label)).toContain(
      'external settings checklist status table missing Evidence/Notes column',
    );
  });

  it('accepts N/A status only when it carries a concrete reason and evidence', () => {
    const root = tempRoot();
    write(
      root,
      'docs/qa/external_settings_checklist.md',
      completedChecklist().replace(
        'PASS | PASS | present in Vercel production+preview, origin=https://twoday-mvp.vercel.app',
        'PASS | N/A(no preview deployment for MVP day 1) | production origin=https://twoday-mvp.vercel.app, preview not used',
      ),
    );

    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root)).toEqual([]);
  });

  it('flags placeholder N/A reasons', () => {
    const root = tempRoot();
    write(
      root,
      'docs/qa/external_settings_checklist.md',
      completedChecklist().replace(
        'PASS | PASS | present in Vercel production+preview, origin=https://twoday-mvp.vercel.app',
        'PASS | N/A(사유) | production origin=https://twoday-mvp.vercel.app, preview not used',
      ),
    );

    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root).map((finding) => finding.label)).toContain(
      'external settings checklist N/A reason is still a placeholder: N/A(사유)',
    );
  });

  it('flags placeholder evidence even when N/A reason is concrete', () => {
    const root = tempRoot();
    write(
      root,
      'docs/qa/external_settings_checklist.md',
      completedChecklist().replace(
        'PASS | PASS | present in Vercel production+preview, origin=https://twoday-mvp.vercel.app',
        'PASS | N/A(no preview deployment for MVP day 1) | fixed production origin',
      ),
    );

    expect(scanExternalSettingsChecklist('docs/qa/external_settings_checklist.md', root).map((finding) => finding.label)).toContain(
      'external settings checklist evidence is still a placeholder: fixed production origin',
    );
  });
});
