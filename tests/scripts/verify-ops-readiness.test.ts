import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../scripts/verify-ops-readiness.ts', import.meta.url),
  'utf8',
);

describe('verify-ops-readiness script', () => {
  it('requires production env for monitoring, budget, and Claude fallback', () => {
    expect(source).toMatch(/const REQUIRED_ENV = \[[\s\S]*'SENTRY_DSN'/);
    expect(source).toMatch(/const REQUIRED_ENV = \[[\s\S]*'NEXT_PUBLIC_SENTRY_DSN'/);
    expect(source).toMatch(/const REQUIRED_ENV = \[[\s\S]*'LLM_DAILY_BUDGET_USD'/);
    expect(source).toMatch(/const REQUIRED_ENV = \[[\s\S]*'ANTHROPIC_API_KEY'/);
  });

  it('requires the evidence generator to refuse automatic service-open decisions', () => {
    expect(source).toContain('Cannot auto-generate 서비스 오픈 가능 evidence');
  });

  it('requires the external settings checklist as an operations artifact', () => {
    expect(source).toContain('docs/qa/external_settings_checklist.md');
    expect(source).toContain('External settings checklist exists');
    expect(source).toContain('OpenAI \\/ ZDR');
    expect(source).toContain('Sentry \\/ Operations');
  });
});
