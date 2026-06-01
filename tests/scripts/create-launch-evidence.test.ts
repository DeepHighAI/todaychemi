import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  renderEvidence,
  type Args,
  type LaunchSummary,
} from '../../scripts/create-launch-evidence';

const source = readFileSync(
  new URL('../../scripts/create-launch-evidence.ts', import.meta.url),
  'utf8',
);

describe('create-launch-evidence script', () => {
  it('documents only auto-generatable Go/No-Go values in CLI usage errors', () => {
    expect(source).toContain("--go-no-go <조건부 가능|오픈 보류>");
    expect(source).toContain('Allowed values: ${AUTO_GENERATED_GO_NO_GO_DECISIONS.join');
    expect(source).not.toContain('Allowed values: ${GO_NO_GO_DECISIONS.join');
  });

  it('turns a secret-free launch summary into evidence markdown without persisting raw child output', () => {
    const summary = {
      generatedAt: '2026-05-30T16:37:06.755Z',
      cwd: process.cwd(),
      verdict: 'FAIL',
      requiredFailures: ['launch env'],
      rawOutput: 'OPENAI_API_KEY=should-not-be-rendered',
      results: [
        {
          name: 'launch env',
          required: true,
          status: 'fail',
          exitCode: 1,
          timedOut: false,
          durationMs: 1455,
          timeoutMs: 120000,
          command: 'pnpm.cmd verify:launch-env',
        },
        {
          name: 'DB/RLS readiness',
          required: true,
          status: 'pass',
          exitCode: 0,
          timedOut: false,
          durationMs: 6800,
          timeoutMs: 180000,
          command: 'pnpm.cmd verify:db-rls-readiness',
        },
      ],
    } satisfies LaunchSummary & { rawOutput: string };
    const args = {
      summaryJson: 'summary.json',
      out: 'evidence.md',
      environment: 'Preview',
      domain: 'https://preview.example.invalid',
      vercelProject: 'TBD',
      deploymentUrl: 'TBD',
      commitSha: 'abc123',
      workingTreeStatus: 'dirty - uncommitted local changes present',
      operator: 'CI',
    } satisfies Args;

    const markdown = renderEvidence(summary, args);
    expect(markdown).toContain('# Launch Evidence - Preview');
    expect(markdown).toContain('| launch env | yes | FAIL |');
    expect(markdown).toContain('| DB/RLS readiness | yes | PASS |');
    expect(markdown).toContain('| Go/No-Go | 오픈 보류 |');
    expect(markdown).toContain('Reason: Launch readiness gate failed; required failures must be cleared before production open.');
    expect(markdown).toContain('| Working tree status | dirty - uncommitted local changes present |');
    expect(markdown).toContain('## Canary Evidence');
    expect(markdown).toContain('| Payment charge and ledger canary | first live low-value order | TBD |');
    expect(markdown).toContain('| paid manual refund/cancel drill | TBD | toss_order_id and owner only |');
    expect(markdown).toContain('| monetary refund/cancel drill | toss_order_id | Toss dashboard/manual refund status and before/after ledger export recorded | TBD |');
    expect(markdown).toContain('| Manual refund/cancel operator canary | first live low-value order or approved dry run | TBD |');
    expect(markdown).not.toContain('should-not-be-rendered');
    expect(markdown).not.toContain('OPENAI_API_KEY');
  });

  it('uses the canonical conditional Go/No-Go label for passing readiness summaries', () => {
    const summary = {
      generatedAt: '2026-05-30T16:37:06.755Z',
      cwd: process.cwd(),
      verdict: 'PASS',
      requiredFailures: [],
      results: [
        {
          name: 'launch env',
          required: true,
          status: 'pass',
          exitCode: 0,
          timedOut: false,
          durationMs: 1455,
          timeoutMs: 120000,
          command: 'pnpm.cmd verify:launch-env',
        },
      ],
    } satisfies LaunchSummary;
    const args = {
      summaryJson: 'summary.json',
      out: 'evidence.md',
      environment: 'Production',
      domain: 'https://example.invalid',
      vercelProject: 'twoday',
      deploymentUrl: 'https://deployment.example.invalid',
      commitSha: 'abc123',
      workingTreeStatus: 'clean',
      operator: 'CI',
    } satisfies Args;

    const markdown = renderEvidence(summary, args);
    expect(markdown).toContain('| Go/No-Go | 조건부 가능 |');
    expect(markdown).toContain('Final decision: 조건부 가능');
    expect(markdown).toContain('Reason: Launch readiness gate passed; accepted residual risks and rollback conditions must be recorded before public traffic.');
  });

  it('rejects auto-generated service-open evidence even for passing production summaries', () => {
    const summary = {
      generatedAt: '2026-05-30T16:37:06.755Z',
      cwd: process.cwd(),
      verdict: 'PASS',
      requiredFailures: [],
      results: [],
    } satisfies LaunchSummary;
    const args = {
      summaryJson: 'summary.json',
      out: 'evidence.md',
      environment: 'Production',
      domain: 'https://example.invalid',
      vercelProject: 'twoday',
      deploymentUrl: 'https://deployment.example.invalid',
      commitSha: 'abc123',
      workingTreeStatus: 'clean',
      operator: 'Launch operator',
      goNoGo: '서비스 오픈 가능',
    } satisfies Args;

    expect(() => renderEvidence(summary, args)).toThrow(
      'Cannot auto-generate 서비스 오픈 가능 evidence. Generate Production evidence first, fill dashboard/smoke/payment/monitoring/canary sections, then update the decision and run verify:launch-evidence-readiness.',
    );
  });

  it('rejects non-hold Go/No-Go decisions when launch readiness failed', () => {
    const summary = {
      generatedAt: '2026-05-30T16:37:06.755Z',
      cwd: process.cwd(),
      verdict: 'FAIL',
      requiredFailures: ['launch env'],
      results: [],
    } satisfies LaunchSummary;
    const args = {
      summaryJson: 'summary.json',
      out: 'evidence.md',
      environment: 'Production',
      domain: 'https://example.invalid',
      vercelProject: 'twoday',
      deploymentUrl: 'https://deployment.example.invalid',
      commitSha: 'abc123',
      workingTreeStatus: 'clean',
      operator: 'Launch operator',
      goNoGo: '서비스 오픈 가능',
    } satisfies Args;

    expect(() => renderEvidence(summary, args)).toThrow('Cannot record 서비스 오픈 가능 when launch readiness verdict is FAIL.');
  });

  it('rejects service-open decision outside production evidence', () => {
    const summary = {
      generatedAt: '2026-05-30T16:37:06.755Z',
      cwd: process.cwd(),
      verdict: 'PASS',
      requiredFailures: [],
      results: [],
    } satisfies LaunchSummary;
    const args = {
      summaryJson: 'summary.json',
      out: 'evidence.md',
      environment: 'Preview',
      domain: 'https://preview.example.invalid',
      vercelProject: 'twoday',
      deploymentUrl: 'https://deployment.example.invalid',
      commitSha: 'abc123',
      workingTreeStatus: 'clean',
      operator: 'Launch operator',
      goNoGo: '서비스 오픈 가능',
    } satisfies Args;

    expect(() => renderEvidence(summary, args)).toThrow(
      '서비스 오픈 가능 can only be recorded for Production evidence.',
    );
  });
});
