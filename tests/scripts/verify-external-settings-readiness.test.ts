import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../scripts/verify-external-settings-readiness.ts', import.meta.url),
  'utf8',
);

describe('verify-external-settings-readiness command list', () => {
  it('runs only the dashboard/env/evidence dependent launch blockers as a focused preflight', () => {
    const expectedScripts = [
      'verify:launch-env',
      'verify:auth-readiness',
      'verify:openai-readiness',
      'verify:toss-live-readiness',
      'verify:vercel-readiness',
      'verify:ops-readiness',
      'verify:external-settings-checklist',
    ];

    for (const scriptName of expectedScripts) {
      expect(source).toContain(`'${scriptName}'`);
    }

    expect(source).toContain('PASS here is not sufficient for launch');
    expect(source).toContain('MVP does not require a custom domain');
    expect(source).toContain('pnpm verify:launch-readiness');
    expect(source).toContain('docs/runbooks/external_launch_settings.md');
    expect(source).toContain('docs/qa/external_settings_checklist.md');
    expect(source).toContain('docs/qa/launch_evidence_template.md');
    expect(source).not.toContain('verify:payment-flow-readiness');
    expect(source).not.toContain('vitest');
    expect(source).not.toContain('build');
  });
});
