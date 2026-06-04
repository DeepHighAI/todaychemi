import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { scanLaunchEvidence } from '../../scripts/verify-launch-evidence-readiness';

const tempDirs: string[] = [];

function tempFile(name: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'launch-evidence-'));
  tempDirs.push(dir);
  const file = join(dir, name);
  writeFileSync(file, content, 'utf8');
  return file;
}

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'launch-evidence-'));
  tempDirs.push(dir);
  return dir;
}

function write(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content, 'utf8');
}

function summaryJson(verdict: 'PASS' | 'FAIL', requiredFailures: string[]) {
  return JSON.stringify(
    {
      generatedAt: '2026-05-31T16:01:01.151Z',
      cwd: 'C:\\DEV\\SAJU',
      verdict,
      requiredFailures,
      results: [],
    },
    null,
    2,
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('verify-launch-evidence-readiness', () => {
  it('documents positional evidence arguments without a pnpm -- separator in launch artifacts', () => {
    const template = readFileSync(new URL('../../docs/qa/launch_evidence_template.md', import.meta.url), 'utf8');
    const runbook = readFileSync(new URL('../../docs/runbooks/launch_opening.md', import.meta.url), 'utf8');

    expect(template).toContain('pnpm verify:launch-evidence-readiness <json> <md> docs/qa/external_settings_checklist.md');
    expect(template).not.toContain('pnpm verify:launch-evidence-readiness -- <json>');
    expect(runbook).toContain('pnpm verify:launch-evidence-readiness docs/qa/launch_gate_<date>_<env>.json');
  });

  it('allows safe launch evidence instructions that mention forbidden field names without values', () => {
    const file = tempFile('safe.md', [
      '# Launch Evidence - Local',
      'Do not add secret values, raw PII, birth_date, nickname, email, or original gender values.',
      'Evidence date/time: 2026-06-01 12:00 KST.',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Local |',
      '| Launch readiness verdict | FAIL |',
      '| Go/No-Go | 오픈 보류 |',
      '| Source summary JSON | summary.json |',
      '| Flow | Evidence |',
      '| relation create/feed | no nickname values |',
      'Final decision: 오픈 보류',
    ].join('\n'));

    expect(scanLaunchEvidence([file])).toEqual([]);
  });

  it('flags secret env assignments and raw PII assignments', () => {
    const file = tempFile('unsafe.md', [
      '# Launch Evidence',
      'OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456',
      'birth_date: "1990-01-01"',
      'signup smoke DOB value 1990/01/01',
      'smoke account: launch-user@example.com',
      'gender: "F"',
    ].join('\n'));

    const findings = scanLaunchEvidence([file]);
    expect(findings.map((finding) => finding.label)).toEqual(
      expect.arrayContaining([
        'OpenAI-style secret key value',
        'server secret env assignment',
        'raw birth_date value assignment',
        'raw birth date evidence',
        'raw email address value',
        'raw original gender assignment',
      ]),
    );
  });

  it('flags missing evidence artifacts', () => {
    const findings = scanLaunchEvidence(['docs/qa/missing-launch-evidence.invalid']);

    expect(findings).toEqual([
      {
        file: 'docs/qa/missing-launch-evidence.invalid',
        label: 'missing evidence file',
        line: 0,
      },
    ]);
  });

  it('scans external settings checklist entries for pasted secret values', () => {
    const file = tempFile('external-settings-checklist.md', [
      '# External Settings Checklist',
      '| Key | Production | Preview | Notes |',
      '|---|---:|---:|---|',
      '| `OPENAI_API_KEY` | sk-proj-abcdefghijklmnopqrstuvwxyz123456 | TBD | pasted by mistake |',
      '| `OPENAI_PROJECT_ID` | proj_abcdefghijklmnop123456 | TBD | pasted by mistake |',
      '| `TOSS_SECRET_KEY` | live_sk_abcdefghi123456789 | TBD | pasted by mistake |',
      '| `SENTRY_DSN` | https://0123456789abcdef0123456789abcdef@o450123456789.ingest.sentry.io/450123456789 | TBD | pasted by mistake |',
      '| `SUPABASE_SERVICE_ROLE_KEY` | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzZXJ2aWNlX3JvbGUifQ.abcdefghijklmnopqrstuvwxyz | TBD | pasted by mistake |',
    ].join('\n'));

    const labels = scanLaunchEvidence([file]).map((finding) => finding.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'OpenAI-style secret key value',
        'full OpenAI project id value',
        'Toss secret/client key value',
        'Sentry DSN URL value',
        'JWT-like token value',
      ]),
    );
  });

  it('flags generated evidence with invalid Go/No-Go structure', () => {
    const file = tempFile('invalid-decision.md', [
      '# Launch Evidence - Production',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Production |',
      '| Launch readiness verdict | FAIL |',
      '| Go/No-Go | 조건부 가능 |',
      'Final decision: 서비스 오픈 가능',
    ].join('\n'));

    const findings = scanLaunchEvidence([file]);
    expect(findings.map((finding) => finding.label)).toEqual(
      expect.arrayContaining([
        'Final decision does not match Go/No-Go value',
        'FAIL launch readiness evidence must remain 오픈 보류',
      ]),
    );
  });

  it('flags service-open evidence outside production', () => {
    const file = tempFile('preview-open.md', [
      '# Launch Evidence - Preview',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Preview |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 서비스 오픈 가능 |',
      'Final decision: 서비스 오픈 가능',
    ].join('\n'));

    expect(scanLaunchEvidence([file]).map((finding) => finding.label)).toContain(
      '서비스 오픈 가능 evidence must be Production environment',
    );
  });

  it('flags service-open evidence with unfilled TBD placeholders', () => {
    const file = tempFile('production-open-with-tbd.md', [
      '# Launch Evidence - Production',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Production |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 서비스 오픈 가능 |',
      '| Domain | TBD |',
      'Final decision: 서비스 오픈 가능',
    ].join('\n'));

    expect(scanLaunchEvidence([file]).map((finding) => finding.label)).toContain(
      '서비스 오픈 가능 evidence must not contain TBD placeholders',
    );
  });

  it('allows completed service-open production evidence with a completed external settings checklist', () => {
    const root = tempDir();
    write(root, 'summary.json', summaryJson('PASS', []));
    write(root, 'production-open-complete.md', [
      '# Launch Evidence - Production',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Production |',
      '| Domain | https://example.invalid |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 서비스 오픈 가능 |',
      '| Source summary JSON | summary.json |',
      '',
      '## Dashboard Evidence',
      '| Area | Required Evidence | Result |',
      '|---|---|---:|',
      '| Vercel | production domain, env presence, rollback deployment | PASS |',
      '',
      '## Production Smoke Notes',
      '| Flow | Result | Evidence |',
      '|---|---:|---|',
      '| signup/login/OAuth callback | PASS | redacted smoke account |',
      '',
      '## Payment Ledger Evidence',
      '| Event | Non-sensitive Reference | Expected | Actual |',
      '|---|---|---|---|',
      '| payment confirm | toss_order_id/feature_ref | confirmed feature unlock, no purchase ledger | matched |',
      '',
      '## Monitoring',
      '| Signal | Window | Result |',
      '|---|---|---:|',
      '| Sentry 5xx rate | 15 min | PASS |',
      '',
      '## Canary Evidence',
      '| Check | Window | Result |',
      '|---|---|---:|',
      '| Rollback deployment confirmed available | before public traffic | PASS |',
      '',
      '## Decision',
      'Final decision: 서비스 오픈 가능',
      'Reason: Launch readiness, dashboard evidence, production smoke, and live feature payment/unlock/token ledger evidence are marked complete by operator.',
      'Known risks accepted: none',
      'Rollback trigger: payment, auth, LLM, or 5xx launch threshold breach',
      'Next review time: 2026-06-01 12:00 KST',
    ].join('\n'));
    write(root, 'external_settings_checklist.md', [
      '# External Settings Checklist',
      '',
      '> Replace each `TBD` table status with OK, PASS, or N/A(concrete reason).',
      '',
      '| Item | Result | Evidence |',
      '|---|---:|---|',
      '| Vercel production project | PASS | project=twoday, origin=https://example.invalid |',
      '| Supabase Auth redirects | PASS | redirect=/auth/callback, providers=google+kakao |',
      '| OpenAI ZDR project | PASS | project=Default project, id_prefix=proj_, zdr=confirmed |',
      '| Toss live dashboard | PASS | keys=live prefixes present, success=/api/payments/feature/confirm |',
      '| Sentry alerts | PASS | alerts=payment-confirm-failure,llm-provider-outage,5xx-spike |',
    ].join('\n'));

    expect(scanLaunchEvidence(['summary.json', 'production-open-complete.md', 'external_settings_checklist.md'], root)).toEqual([]);
  });

  it('flags service-open production evidence when the external settings checklist is not included', () => {
    const file = tempFile('production-open-no-checklist.md', [
      '# Launch Evidence - Production',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Production |',
      '| Domain | https://example.invalid |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 서비스 오픈 가능 |',
      '| Source summary JSON | summary.json |',
      '',
      '## Dashboard Evidence',
      '## Production Smoke Notes',
      '## Payment Ledger Evidence',
      '## Monitoring',
      '## Canary Evidence',
      '## Decision',
      'Final decision: 서비스 오픈 가능',
      'Reason: complete',
      'Known risks accepted: none',
      'Rollback trigger: breach',
      'Next review time: 2026-06-01 12:00 KST',
    ].join('\n'));

    expect(scanLaunchEvidence([file]).map((finding) => finding.label)).toContain(
      '서비스 오픈 가능 evidence must include external settings checklist in verification inputs',
    );
  });

  it('flags service-open production evidence when the external settings checklist still has placeholders', () => {
    const root = tempDir();
    write(root, 'production-open.md', [
      '# Launch Evidence - Production',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Production |',
      '| Domain | https://example.invalid |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 서비스 오픈 가능 |',
      '| Source summary JSON | summary.json |',
      '',
      '## Dashboard Evidence',
      '## Production Smoke Notes',
      '## Payment Ledger Evidence',
      '## Monitoring',
      '## Canary Evidence',
      '## Decision',
      'Final decision: 서비스 오픈 가능',
      'Reason: complete',
      'Known risks accepted: none',
      'Rollback trigger: breach',
      'Next review time: 2026-06-01 12:00 KST',
    ].join('\n'));
    write(root, 'external_settings_checklist.md', [
      '# External Settings Checklist',
      '',
      '| Item | Result | Evidence |',
      '|---|---:|---|',
      '| Vercel production project | TBD | project name only |',
      '| Toss live dashboard | FAIL | live_ck_... prefix only |',
      '| OpenAI ZDR project | PASS | TBD |',
      '| OpenAI project selected | PASS | project name/id prefix only |',
    ].join('\n'));

    const findings = scanLaunchEvidence(['production-open.md', 'external_settings_checklist.md'], root);
    const labels = findings.map((finding) => finding.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        '서비스 오픈 가능 external settings checklist must not contain TBD placeholders',
        '서비스 오픈 가능 external settings checklist must not contain FAIL status cells',
        '서비스 오픈 가능 external settings checklist evidence is still a placeholder: project name only',
        '서비스 오픈 가능 external settings checklist evidence is still a placeholder: live_ck_... prefix only',
        '서비스 오픈 가능 external settings checklist evidence is still a placeholder: TBD',
        '서비스 오픈 가능 external settings checklist evidence is still a placeholder: project name/id prefix only',
      ]),
    );
    expect(
      findings.find((finding) => finding.label === '서비스 오픈 가능 external settings checklist must not contain TBD placeholders')?.context,
    ).toBe('Vercel production project');
  });

  it('flags service-open production evidence when checklist status tables omit evidence columns', () => {
    const root = tempDir();
    write(root, 'production-open.md', [
      '# Launch Evidence - Production',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Production |',
      '| Domain | https://example.invalid |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 서비스 오픈 가능 |',
      '| Source summary JSON | summary.json |',
      '',
      '## Dashboard Evidence',
      '## Production Smoke Notes',
      '## Payment Ledger Evidence',
      '## Monitoring',
      '## Canary Evidence',
      '## Decision',
      'Final decision: 서비스 오픈 가능',
      'Reason: complete',
      'Known risks accepted: none',
      'Rollback trigger: breach',
      'Next review time: 2026-06-01 12:00 KST',
    ].join('\n'));
    write(root, 'external_settings_checklist.md', [
      '# External Settings Checklist',
      '',
      '| Key | Production | Preview |',
      '|---|---:|---:|',
      '| `TOSS_PAYMENTS_CLIENT_KEY` | PASS | PASS |',
    ].join('\n'));

    expect(scanLaunchEvidence(['production-open.md', 'external_settings_checklist.md'], root).map((finding) => finding.label)).toContain(
      '서비스 오픈 가능 external settings checklist status table missing Evidence/Notes column',
    );
  });

  it('flags service-open production evidence that omits operational evidence sections', () => {
    const file = tempFile('production-open-thin.md', [
      '# Launch Evidence - Production',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Production |',
      '| Domain | https://example.invalid |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 서비스 오픈 가능 |',
      '| Source summary JSON | summary.json |',
      'Final decision: 서비스 오픈 가능',
      'Reason: Launch readiness passed.',
    ].join('\n'));

    const labels = scanLaunchEvidence([file]).map((finding) => finding.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        '서비스 오픈 가능 evidence missing required section: ## Dashboard Evidence',
        '서비스 오픈 가능 evidence missing required section: ## Production Smoke Notes',
        '서비스 오픈 가능 evidence missing required section: ## Payment Ledger Evidence',
        '서비스 오픈 가능 evidence missing required section: ## Monitoring',
        '서비스 오픈 가능 evidence missing required section: ## Canary Evidence',
        '서비스 오픈 가능 evidence missing required section: ## Decision',
        '서비스 오픈 가능 evidence missing decision field: Known risks accepted',
        '서비스 오픈 가능 evidence missing decision field: Rollback trigger',
        '서비스 오픈 가능 evidence missing decision field: Next review time',
      ]),
    );
  });

  it('flags conditional production evidence when risk and rollback decision fields are missing', () => {
    const file = tempFile('production-conditional-thin.md', [
      '# Launch Evidence - Production',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Production |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 조건부 가능 |',
      '| Source summary JSON | summary.json |',
      'Final decision: 조건부 가능',
      'Reason: Launch readiness passed with accepted residual P1 risks.',
    ].join('\n'));

    expect(scanLaunchEvidence([file]).map((finding) => finding.label)).toEqual(
      expect.arrayContaining([
        '조건부 가능 evidence missing decision field: Known risks accepted',
        '조건부 가능 evidence missing decision field: Rollback trigger',
        '조건부 가능 evidence missing decision field: Next review time',
      ]),
    );
  });

  it('allows conditional production evidence when risk and rollback decision fields are recorded', () => {
    const root = tempDir();
    write(root, 'summary.json', summaryJson('PASS', []));
    write(root, 'production-conditional-complete.md', [
      '# Launch Evidence - Production',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Production |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 조건부 가능 |',
      '| Source summary JSON | summary.json |',
      '',
      '## Dashboard Evidence',
      '| Area | Required Evidence | Result |',
      '|---|---|---:|',
      '| Vercel | production domain, env presence, rollback deployment | PASS |',
      '',
      '## Production Smoke Notes',
      '| Flow | Result | Evidence |',
      '|---|---:|---|',
      '| signup/login/OAuth callback | PASS | redacted smoke account |',
      '',
      '## Payment Ledger Evidence',
      '| Event | Non-sensitive Reference | Expected | Actual |',
      '|---|---|---|---|',
      '| payment confirm | toss_order_id/feature_ref | confirmed feature unlock, no purchase ledger | matched |',
      '',
      '## Monitoring',
      '| Signal | Window | Result |',
      '|---|---|---:|',
      '| Sentry 5xx rate | 15 min | PASS |',
      '',
      '## Canary Evidence',
      '| Check | Window | Result |',
      '|---|---|---:|',
      '| Rollback deployment confirmed available | before public traffic | PASS |',
      '',
      '## Decision',
      'Final decision: 조건부 가능',
      'Reason: Launch readiness passed with accepted residual P1 risks.',
      'Known risks accepted: moderate advisories are reviewed and accepted for MVP window',
      'Rollback trigger: payment, auth, LLM, or 5xx launch threshold breach',
      'Next review time: 2026-06-01 12:00 KST',
    ].join('\n'));
    write(root, 'external_settings_checklist.md', [
      '# External Settings Checklist',
      '',
      '| Item | Result | Evidence |',
      '|---|---:|---|',
      '| Vercel production project | PASS | project=twoday, origin=https://example.invalid |',
      '| Supabase Auth redirects | PASS | redirect=/auth/callback, providers=google+kakao |',
      '| OpenAI ZDR project | PASS | project=Default project, id_prefix=proj_, zdr=confirmed |',
      '| Toss live dashboard | PASS | keys=live prefixes present, success=/api/payments/feature/confirm |',
      '| Sentry alerts | PASS | alerts=payment-confirm-failure,llm-provider-outage,5xx-spike |',
    ].join('\n'));

    expect(scanLaunchEvidence(['summary.json', 'production-conditional-complete.md', 'external_settings_checklist.md'], root)).toEqual([]);
  });

  it('flags launch-allowed production evidence when the launch summary JSON is not included', () => {
    const file = tempFile('production-conditional-no-summary.md', [
      '# Launch Evidence - Production',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Production |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 조건부 가능 |',
      '| Source summary JSON | summary.json |',
      '## Dashboard Evidence',
      '## Production Smoke Notes',
      '## Payment Ledger Evidence',
      '## Monitoring',
      '## Canary Evidence',
      '## Decision',
      'Final decision: 조건부 가능',
      'Reason: Launch readiness passed with accepted residual P1 risks.',
      'Known risks accepted: moderate advisories are reviewed and accepted for MVP window',
      'Rollback trigger: payment, auth, LLM, or 5xx launch threshold breach',
      'Next review time: 2026-06-01 12:00 KST',
    ].join('\n'));

    expect(scanLaunchEvidence([file]).map((finding) => finding.label)).toContain(
      '조건부 가능 evidence must include launch summary JSON in verification inputs',
    );
  });

  it('flags conditional production evidence when the external settings checklist is not included', () => {
    const file = tempFile('production-conditional-no-checklist.md', [
      '# Launch Evidence - Production',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Production |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 조건부 가능 |',
      '| Source summary JSON | summary.json |',
      '## Dashboard Evidence',
      '## Production Smoke Notes',
      '## Payment Ledger Evidence',
      '## Monitoring',
      '## Canary Evidence',
      '## Decision',
      'Final decision: 조건부 가능',
      'Reason: Launch readiness passed with accepted residual P1 risks.',
      'Known risks accepted: moderate advisories are reviewed and accepted for MVP window',
      'Rollback trigger: payment, auth, LLM, or 5xx launch threshold breach',
      'Next review time: 2026-06-01 12:00 KST',
    ].join('\n'));

    expect(scanLaunchEvidence([file]).map((finding) => finding.label)).toContain(
      '조건부 가능 evidence must include external settings checklist in verification inputs',
    );
  });

  it('flags generated evidence without source summary reference', () => {
    const file = tempFile('missing-source-summary.md', [
      '# Launch Evidence - Local',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Local |',
      '| Launch readiness verdict | FAIL |',
      '| Go/No-Go | 오픈 보류 |',
      'Final decision: 오픈 보류',
    ].join('\n'));

    expect(scanLaunchEvidence([file]).map((finding) => finding.label)).toContain(
      'generated evidence missing Source summary JSON',
    );
  });

  it('accepts generated evidence that matches the provided launch summary JSON', () => {
    const root = tempDir();
    write(root, 'summary.json', summaryJson('FAIL', ['launch env']));
    write(root, 'evidence.md', [
      '# Launch Evidence - Local',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Local |',
      '| Launch readiness verdict | FAIL |',
      '| Go/No-Go | 오픈 보류 |',
      '| Source summary JSON | summary.json |',
      '',
      '| Gate | Required Action |',
      '|---|---|',
      '| launch env | Must be cleared before production open |',
      'Final decision: 오픈 보류',
    ].join('\n'));

    expect(scanLaunchEvidence(['summary.json', 'evidence.md'], root)).toEqual([]);
  });

  it('flags generated evidence that does not match the provided launch summary JSON', () => {
    const root = tempDir();
    write(root, 'summary.json', summaryJson('FAIL', ['OpenAI/ZDR readiness']));
    write(root, 'evidence.md', [
      '# Launch Evidence - Local',
      '| Field | Value |',
      '|---|---|',
      '| Environment | Local |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 조건부 가능 |',
      '| Source summary JSON | summary.json |',
      '',
      '| Gate | Required Action |',
      '|---|---|',
      '| launch env | Must be cleared before production open |',
      'Final decision: 조건부 가능',
    ].join('\n'));

    const findings = scanLaunchEvidence(['summary.json', 'evidence.md'], root);
    expect(findings.map((finding) => finding.label)).toEqual(
      expect.arrayContaining([
        'evidence launch readiness verdict does not match summary JSON',
        'evidence required failure rows do not match summary JSON',
      ]),
    );
  });
});
