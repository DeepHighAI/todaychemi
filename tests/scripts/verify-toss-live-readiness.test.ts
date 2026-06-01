import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../scripts/verify-toss-live-readiness.ts', import.meta.url),
  'utf8',
);

describe('verify-toss-live-readiness script', () => {
  it('fails launch readiness when Toss legacy aliases are present', () => {
    expect(source).toContain("checkPrefix('TOSS_CLIENT_KEY'");
    expect(source).toContain("checkPrefix('TOSS_SECRET_KEY'");
    expect(source).toContain("checkUnset('TOSS_PAYMENTS_CLIENT_KEY legacy alias'");
    expect(source).toContain("checkUnset('TOSS_PAYMENTS_SECRET_KEY legacy alias'");
    expect(source).toContain("console.log(`[env] ${ok ? 'OK' : 'FAIL'} ${label} unset for launch canonical env`)");
    expect(source).toContain('return ok;');
    expect(source).not.toContain("${ok ? 'OK' : 'WARN'} ${label} unset for launch canonical env");
  });
});
