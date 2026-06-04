import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../scripts/verify-supabase-security-readiness.ts', import.meta.url),
  'utf8',
);

describe('verify-supabase-security-readiness', () => {
  it('checks the active pay-per-use payment RPC, not the removed token-purchase RPC', () => {
    expect(source).toContain("name: 'confirm_feature_payment'");
    expect(source).toContain('confirms pay-per-use feature payments without crediting tokens');
    expect(source).toContain('legacyTokenPurchaseDropped');
    expect(source).toContain('drop\\s+function\\s+if\\s+exists\\s+public\\.confirm_token_purchase');
    expect(source).toContain('Keep pnpm db:push:dry PASS');
    expect(source).not.toContain("name: 'confirm_token_purchase'");
    expect(source).not.toContain('Apply the approved security migration to production Supabase');
  });
});
