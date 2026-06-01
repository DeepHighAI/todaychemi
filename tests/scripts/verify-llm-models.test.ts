import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../scripts/verify-llm-models.ts', import.meta.url),
  'utf8',
);

describe('verify-llm-models script', () => {
  it('fails closed when project routing or target model access is not proven', () => {
    expect(source).toContain('Missing OPENAI_PROJECT_ID');
    expect(source).toContain('/^proj_[A-Za-z0-9]+$/');
    expect(source).toContain("const TARGET_MODELS = ['gpt-5', 'gpt-5-mini'] as const");
    expect(source).toMatch(/notFound\.length > 0[\s\S]{0,300}process\.exit\(1\)/);
    expect(source).toMatch(/ERROR 발생 모델 있음[\s\S]{0,120}process\.exit\(1\)/);
  });
});
