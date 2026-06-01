import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../scripts/verify-openai-readiness.ts', import.meta.url),
  'utf8',
);

describe('verify-openai-readiness script', () => {
  it('keeps production OpenAI project routing checks strict and secret-free', () => {
    expect(source).toContain("for (const key of ['OPENAI_API_KEY', 'OPENAI_PROJECT_ID'])");
    expect(source).toContain('checkOpenAiProjectIdShape(env)');
    expect(source).toContain('/^proj_[A-Za-z0-9]+$/');
    expect(source).toContain('OPENAI_PROJECT_ID uses proj_* format');
    expect(source).toContain('main OpenAI client passes project option');
    expect(source).toContain('hapcard/replay/whatif OpenAI calls disable storage');
    expect(source).toContain('legacy OpenAI factory export uses canonical project-routed client');
    expect(source).toContain("spawnSync(PNPM, ['verify:llm-models']");
    expect(source).toContain('GPT-5/GPT-5 mini access check');
    expect(source).toContain('SKIP GPT-5/GPT-5 mini access check until OPENAI_API_KEY and valid OPENAI_PROJECT_ID are configured');
    expect(source).not.toContain('OPENAI_API_KEY=');
  });
});
