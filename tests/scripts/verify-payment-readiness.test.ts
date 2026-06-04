import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('verify-payment-readiness script', () => {
  const source = readFileSync(resolve(process.cwd(), 'scripts/verify-payment-readiness.ts'), 'utf8');

  it('guards the pay-per-use payment spec against stale token-charge confirm checklist drift', () => {
    expect(source).toContain('docs/specs/payments.md');
    expect(source).toContain('`/api/payments/feature/confirm` 서버 저장 금액 검증 확인');
    expect(source).toContain('no stale token-charge confirm checklist');
    expect(source).toContain('`\\/api\\/payments\\/confirm`');
  });
});
